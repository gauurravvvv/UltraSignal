/**
 * crypto.service — envelope encryption for org-scoped secrets.
 *
 * Design (no third-party services):
 *
 *   ┌─ Master key (32 bytes, loaded once at boot, never in DB) ─┐
 *   │   loaded by utility/masterKey.ts                          │
 *   └─────────────────┬─────────────────────────────────────────┘
 *                     │ wraps
 *                     ▼
 *   ┌─ Per-org DEK (32 random bytes, generated at org creation) ┐
 *   │   stored in OrganisationConfig.encryptedDek as ciphertext │
 *   └─────────────────┬─────────────────────────────────────────┘
 *                     │ encrypts
 *                     ▼
 *   ┌─ Org secrets (datasource creds, SMTP/SES creds, ...)      ┐
 *   │   stored as v1:<iv>:<tag>:<ct>                            │
 *   └────────────────────────────────────────────────────────────┘
 *
 * Algorithm: AES-256-GCM. Hardcoded — not configurable per org.
 * AEAD gives confidentiality + integrity in one primitive.
 *
 * IVs: 12 random bytes from `crypto.randomBytes()` per encryption.
 * Reusing an IV with the same key catastrophically breaks GCM, so
 * every encryption gets its own.
 *
 * Ciphertext format: `v1:<iv_hex>:<authtag_hex>:<encrypted_hex>`
 * The `v1` prefix is a version tag. If we ever change algorithm or
 * format, new ciphertexts get `v2:...` and the decryptor can branch
 * on the version. Old `v1:` values still decrypt cleanly.
 *
 * Memory hygiene: every place we hold a DEK as a Buffer, we zero
 * it after use with `.fill(0)`. Node doesn't give us perfect
 * control over heap copies, but this at least scrubs the primary
 * reference so a later memory dump doesn't trivially leak it.
 */
import crypto from 'crypto';
import Logger from '../utility/logger/logger';
import { loadMasterKey } from '../utility/masterKey';

const ALG = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const VERSION = 'v1';

/**
 * Generate a fresh 32-byte Data Encryption Key. Used at org creation
 * (and on key rotation). The caller is responsible for wrapping the
 * returned buffer with `wrapDek()` before persisting it. Never store
 * a raw DEK.
 */
export function generateDek(): Buffer {
  return crypto.randomBytes(KEY_BYTES);
}

/**
 * Wrap a DEK under the master key. The returned string is safe to
 * store in the DB — it's only useful to anyone who also has the
 * master key.
 */
export function wrapDek(dek: Buffer): string {
  if (dek.length !== KEY_BYTES) {
    throw new Error(`DEK must be ${KEY_BYTES} bytes, got ${dek.length}`);
  }
  const master = loadMasterKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALG, master, iv) as crypto.CipherGCM;
  const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Unwrap a stored DEK with the master key. Caller MUST scrub the
 * returned buffer (`.fill(0)`) once it's no longer needed.
 *
 * Throws on:
 *   - malformed wrapped value
 *   - wrong version
 *   - GCM auth-tag mismatch (corrupted ciphertext or wrong master key)
 */
export function unwrapDek(wrapped: string): Buffer {
  const parts = wrapped.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Wrapped DEK is malformed or has unsupported version');
  }
  const [, ivHex, tagHex, ctHex] = parts;
  const master = loadMasterKey();
  const decipher = crypto.createDecipheriv(
    ALG,
    master,
    Buffer.from(ivHex, 'hex'),
  ) as crypto.DecipherGCM;
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(ctHex, 'hex')),
    decipher.final(),
  ]);
}

/**
 * Encrypt a plaintext secret under an org's DEK. The wrapped DEK is
 * read off the org's config row. The unwrapped DEK is scrubbed from
 * memory before this function returns.
 *
 * The plaintext is always UTF-8. Passing arbitrary binary is not
 * supported (no current call site needs it).
 */
export function encryptForOrg(
  plaintext: string,
  orgConfig: { encryptedDek?: string | null },
): string {
  if (!orgConfig.encryptedDek) {
    throw new Error(
      'Organisation has no wrapped DEK; cannot encrypt. ' +
        'Either it was created with the legacy pepper scheme and needs migration, ' +
        'or its config row is corrupt.',
    );
  }
  const dek = unwrapDek(orgConfig.encryptedDek);
  try {
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALG, dek, iv) as crypto.CipherGCM;
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${VERSION}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  } finally {
    dek.fill(0);
  }
}

/**
 * Decrypt a stored ciphertext with the org's DEK. Mirror of
 * `encryptForOrg`. Throws on auth-tag mismatch (tampering).
 */
export function decryptForOrg(
  ciphertext: string,
  orgConfig: { encryptedDek?: string | null },
): string {
  if (!orgConfig.encryptedDek) {
    throw new Error('Organisation has no wrapped DEK; cannot decrypt');
  }
  const parts = ciphertext.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Ciphertext is malformed or has unsupported version');
  }
  const [, ivHex, tagHex, ctHex] = parts;
  const dek = unwrapDek(orgConfig.encryptedDek);
  try {
    const decipher = crypto.createDecipheriv(
      ALG,
      dek,
      Buffer.from(ivHex, 'hex'),
    ) as crypto.DecipherGCM;
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ctHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch (err: any) {
    // Don't leak the err.message — it can describe internals of the
    // cipher state. Log it; surface a generic error to the caller.
    Logger.error(`decryptForOrg failed: ${err?.message ?? 'unknown'}`);
    throw new Error('Failed to decrypt org secret');
  } finally {
    dek.fill(0);
  }
}

/**
 * Sentinel used by migration code to detect ciphertext that came
 * from the legacy pepper-based scheme. Legacy values were either
 * `<iv>:<ct>` (CBC) or `<iv>:<tag>:<ct>` (GCM) with no version tag.
 * New ciphertexts ALWAYS start with `v1:`.
 */
export function isV1Ciphertext(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(`${VERSION}:`);
}
