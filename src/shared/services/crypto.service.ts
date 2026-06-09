/**
 * crypto.service — symmetric AES-256-GCM encryption for client-scoped secrets.
 *
 * Single-layer design (no per-client DEK):
 *
 *   ┌─ Master key (32 bytes, loaded once at boot from env) ─┐
 *   │   utility/masterKey.ts (ULTRASIGNAL_MASTER_KEY)        │
 *   └──────────────────┬─────────────────────────────────────┘
 *                      │ encrypts every client's secrets
 *                      ▼
 *   ┌─ Client secrets (passwords, setup tokens, SMTP/SES creds, …) ┐
 *   │   stored as v1:<iv_hex>:<tag_hex>:<ct_hex>                   │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Algorithm: AES-256-GCM. AEAD = confidentiality + integrity in one primitive.
 * IVs: 12 random bytes per encryption (reusing IV with same key breaks GCM).
 * Ciphertext format: `v1:<iv_hex>:<authtag_hex>:<encrypted_hex>`.
 *
 * Trade-off vs the previous envelope-encryption scheme: a single master-key
 * compromise now exposes ALL clients' secrets (previously: one client only).
 * The simpler model means zero per-client key plumbing and no on-disk DEK
 * to lose or rotate.
 */
import crypto from 'crypto';
import Logger from '../utility/logger/logger';
import { loadMasterKey } from '../utility/masterKey';

const ALG = 'aes-256-gcm';
const IV_BYTES = 12;
const VERSION = 'v1';

/**
 * Encrypt a UTF-8 plaintext under the platform master key. Output is
 * `v1:<iv>:<tag>:<ct>` (hex sections).
 */
export function encryptForClient(plaintext: string): string {
  const key = loadMasterKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALG, key, iv) as crypto.CipherGCM;
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a `v1:<iv>:<tag>:<ct>` ciphertext with the master key.
 * Throws a generic "failed to decrypt" error on any failure — internal
 * cipher state is logged but never leaked to the caller.
 */
export function decryptForClient(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Ciphertext is malformed or has unsupported version');
  }
  const [, ivHex, tagHex, ctHex] = parts;
  const key = loadMasterKey();
  try {
    const decipher = crypto.createDecipheriv(
      ALG,
      key,
      Buffer.from(ivHex, 'hex'),
    ) as crypto.DecipherGCM;
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ctHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch (err: any) {
    Logger.error(`decryptForClient failed: ${err?.message ?? 'unknown'}`);
    throw new Error('Failed to decrypt client secret');
  }
}
