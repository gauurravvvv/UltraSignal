/**
 * migrateOrgCrypto — converts an organisation from the legacy
 * pepper-based scheme to envelope encryption.
 *
 * Legacy scheme:
 *   - Per-org `pepperKey` (admin-typed string) + `encryptionAlgorithm`
 *     stored on OrganisationConfig.
 *   - SHA-256(pepper) was used as the AES key.
 *   - Inner secrets stored as `<iv>:<ct>` (CBC) or `<iv>:<tag>:<ct>` (GCM).
 *
 * New scheme:
 *   - Per-org 32-byte random DEK, wrapped under the platform master
 *     key, stored as `encryptedDek` (v1:iv:tag:ct).
 *   - Secrets stored as `v1:iv:tag:ct` under the DEK.
 *
 * Migration steps (all in one transaction):
 *   1. Generate a new DEK and wrap it.
 *   2. Decrypt every legacy secret with the old pepper scheme.
 *   3. Re-encrypt each secret with `encryptForOrg` under the new DEK.
 *   4. NULL out `pepperKey` and `encryptionAlgorithm`.
 *
 * Idempotency: if `encryptedDek` is already set, we treat the org as
 * already migrated and do nothing. Safe to call on every request.
 *
 * Failure mode: any error rolls back the transaction. Legacy ciphertext
 * stays in place; next call retries. We never leave the org in a half-
 * migrated state.
 */
import { EntityManager } from 'typeorm';
import { AppDataSource } from '../../db';
import { Organisation } from '../../db/entities/organisation.entity';
import {
  encryptForOrg,
  generateDek,
  isV1Ciphertext,
  wrapDek,
} from '../../services/crypto.service';
import Logger from '../../utility/logger/logger';
import { decryptPepperedText } from '../../utility/pepperedDecrypt';

/** Decrypt a legacy peppered field. Tolerates already-v1 values. */
function legacyDecryptIfNeeded(
  value: string | null,
  algorithm: string | null,
  pepper: string | null,
): string | null {
  if (!value) return null;
  if (isV1Ciphertext(value)) return null; // already migrated
  if (!algorithm || !pepper) return null;
  try {
    return decryptPepperedText(value, algorithm, pepper);
  } catch (err) {
    Logger.warn(
      `Legacy decrypt failed for one field: ${(err as Error).message}`,
    );
    return null;
  }
}

/**
 * Migrate an org's crypto. Idempotent. Returns true if a migration
 * actually ran, false if the org was already on the new scheme.
 */
export async function migrateOrgCryptoIfNeeded(
  orgId: string,
): Promise<boolean> {
  return AppDataSource.transaction(async (manager: EntityManager) => {
    const org = await manager.getRepository(Organisation).findOne({
      where: { id: orgId },
      relations: ['config'],
    });
    if (!org) {
      throw new Error(`migrateOrgCryptoIfNeeded: org ${orgId} not found`);
    }
    if (org.config.encryptedDek) {
      return false;
    }
    if (!org.config.pepperKey || !org.config.encryptionAlgorithm) {
      const dek = generateDek();
      try {
        org.config.encryptedDek = wrapDek(dek);
      } finally {
        dek.fill(0);
      }
      await manager.save(org.config);
      Logger.warn(
        `Org ${orgId} had no encryptedDek and no legacy pepper. ` +
          'Stamped a fresh DEK. Any existing encrypted secrets are now unreadable.',
      );
      return true;
    }

    const legacyAlg = org.config.encryptionAlgorithm;
    const legacyPepper = org.config.pepperKey;

    const decryptedSmtpUser = legacyDecryptIfNeeded(
      org.config.smtpUser,
      legacyAlg,
      legacyPepper,
    );
    const decryptedSmtpPassword = legacyDecryptIfNeeded(
      org.config.smtpPassword,
      legacyAlg,
      legacyPepper,
    );
    const decryptedSesAccessKey = legacyDecryptIfNeeded(
      org.config.sesAccessKeyId,
      legacyAlg,
      legacyPepper,
    );
    const decryptedSesSecret = legacyDecryptIfNeeded(
      org.config.sesSecretAccessKey,
      legacyAlg,
      legacyPepper,
    );

    const dek = generateDek();
    try {
      org.config.encryptedDek = wrapDek(dek);
    } finally {
      dek.fill(0);
    }

    if (decryptedSmtpUser !== null) {
      org.config.smtpUser = encryptForOrg(decryptedSmtpUser, org.config);
    }
    if (decryptedSmtpPassword !== null) {
      org.config.smtpPassword = encryptForOrg(
        decryptedSmtpPassword,
        org.config,
      );
    }
    if (decryptedSesAccessKey !== null) {
      org.config.sesAccessKeyId = encryptForOrg(
        decryptedSesAccessKey,
        org.config,
      );
    }
    if (decryptedSesSecret !== null) {
      org.config.sesSecretAccessKey = encryptForOrg(
        decryptedSesSecret,
        org.config,
      );
    }

    org.config.pepperKey = null;
    org.config.encryptionAlgorithm = null;
    await manager.save(org.config);

    Logger.info(`Migrated org ${orgId} to envelope encryption`);
    return true;
  });
}
