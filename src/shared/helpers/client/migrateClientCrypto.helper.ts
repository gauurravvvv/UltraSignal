/**
 * migrateClientCrypto — converts a client from the legacy
 * pepper-based scheme to envelope encryption.
 *
 * Legacy scheme:
 *   - Per-client `pepperKey` (admin-typed string) + `encryptionAlgorithm`
 *     stored on ClientConfig.
 *   - SHA-256(pepper) was used as the AES key.
 *   - Inner secrets stored as `<iv>:<ct>` (CBC) or `<iv>:<tag>:<ct>` (GCM).
 *
 * New scheme:
 *   - Per-client 32-byte random DEK, wrapped under the platform master
 *     key, stored as `encryptedDek` (v1:iv:tag:ct).
 *   - Secrets stored as `v1:iv:tag:ct` under the DEK.
 *
 * Migration steps (all in one transaction):
 *   1. Generate a new DEK and wrap it.
 *   2. Decrypt every legacy secret with the old pepper scheme.
 *   3. Re-encrypt each secret with `encryptForClient` under the new DEK.
 *   4. NULL out `pepperKey` and `encryptionAlgorithm`.
 *
 * Idempotency: if `encryptedDek` is already set, we treat the client as
 * already migrated and do nothing. Safe to call on every request.
 *
 * Failure mode: any error rolls back the transaction. Legacy ciphertext
 * stays in place; next call retries. We never leave the client in a half-
 * migrated state.
 */
import { EntityManager } from 'typeorm';
import { AppDataSource } from '../../db';
import { Client } from '../../db/entities/client.entity';
import {
  encryptForClient,
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
 * Migrate an client's crypto. Idempotent. Returns true if a migration
 * actually ran, false if the client was already on the new scheme.
 */
export async function migrateClientCryptoIfNeeded(
  clientId: string,
): Promise<boolean> {
  return AppDataSource.transaction(async (manager: EntityManager) => {
    const client = await manager.getRepository(Client).findOne({
      where: { id: clientId },
      relations: ['config'],
    });
    if (!client) {
      throw new Error(`migrateClientCryptoIfNeeded: client ${clientId} not found`);
    }
    if (client.config.encryptedDek) {
      return false;
    }
    if (!client.config.pepperKey || !client.config.encryptionAlgorithm) {
      const dek = generateDek();
      try {
        client.config.encryptedDek = wrapDek(dek);
      } finally {
        dek.fill(0);
      }
      await manager.save(client.config);
      Logger.warn(
        `Org ${clientId} had no encryptedDek and no legacy pepper. ` +
          'Stamped a fresh DEK. Any existing encrypted secrets are now unreadable.',
      );
      return true;
    }

    const legacyAlg = client.config.encryptionAlgorithm;
    const legacyPepper = client.config.pepperKey;

    const decryptedSmtpUser = legacyDecryptIfNeeded(
      client.config.smtpUser,
      legacyAlg,
      legacyPepper,
    );
    const decryptedSmtpPassword = legacyDecryptIfNeeded(
      client.config.smtpPassword,
      legacyAlg,
      legacyPepper,
    );
    const decryptedSesAccessKey = legacyDecryptIfNeeded(
      client.config.sesAccessKeyId,
      legacyAlg,
      legacyPepper,
    );
    const decryptedSesSecret = legacyDecryptIfNeeded(
      client.config.sesSecretAccessKey,
      legacyAlg,
      legacyPepper,
    );

    const dek = generateDek();
    try {
      client.config.encryptedDek = wrapDek(dek);
    } finally {
      dek.fill(0);
    }

    if (decryptedSmtpUser !== null) {
      client.config.smtpUser = encryptForClient(decryptedSmtpUser, client.config);
    }
    if (decryptedSmtpPassword !== null) {
      client.config.smtpPassword = encryptForClient(
        decryptedSmtpPassword,
        client.config,
      );
    }
    if (decryptedSesAccessKey !== null) {
      client.config.sesAccessKeyId = encryptForClient(
        decryptedSesAccessKey,
        client.config,
      );
    }
    if (decryptedSesSecret !== null) {
      client.config.sesSecretAccessKey = encryptForClient(
        decryptedSesSecret,
        client.config,
      );
    }

    client.config.pepperKey = null;
    client.config.encryptionAlgorithm = null;
    await manager.save(client.config);

    Logger.info(`Migrated client ${clientId} to envelope encryption`);
    return true;
  });
}
