/**
 * masterKey — single source of the platform-wide master encryption key.
 *
 * The master key wraps every per-org Data Encryption Key (DEK). A DB
 * dump alone is useless to an attacker without this key.
 *
 * Source: the `ULTRASIGNAL_MASTER_KEY` environment variable. We treat it
 * the same as every other secret in the app (DB password, JWT secret,
 * SMTP credentials) — `.env` is the one place ops look for them.
 *
 * The value must be a 32-byte (AES-256) key, base64-encoded. Generate
 * with:
 *
 *     openssl rand -base64 32
 *
 * If the variable is missing or the value doesn't decode to 32 bytes,
 * the process refuses to start. There is no fallback.
 *
 * Lifetime: read once at boot, cached in module-level memory for the
 * life of the process. Never persisted, never logged, never sent over
 * the wire.
 */
import Logger from './logger/logger';

const MASTER_KEY_BYTES = 32; // AES-256
let cached: Buffer | null = null;

/**
 * Returns the master key buffer. Call this lazily from any code that
 * needs to wrap/unwrap a DEK; the first call loads + validates the
 * key, subsequent calls return the cached buffer.
 *
 * Throws on any misconfiguration. Callers should let the error
 * propagate — the BE shouldn't keep running with no master key.
 */
export function loadMasterKey(): Buffer {
  if (cached) return cached;

  const raw = process.env.ULTRASIGNAL_MASTER_KEY?.trim();
  if (!raw) {
    throw new Error(
      'ULTRASIGNAL_MASTER_KEY is not set. Add it to your .env file. ' +
        'Generate one with: openssl rand -base64 32',
    );
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(raw, 'base64');
  } catch {
    throw new Error('ULTRASIGNAL_MASTER_KEY is not valid base64');
  }
  if (buf.length !== MASTER_KEY_BYTES) {
    throw new Error(
      `ULTRASIGNAL_MASTER_KEY decoded to ${buf.length} bytes; expected ${MASTER_KEY_BYTES} (AES-256). ` +
        'Regenerate with: openssl rand -base64 32',
    );
  }

  cached = buf;
  Logger.info('Master key loaded from ULTRASIGNAL_MASTER_KEY');
  return cached;
}

/**
 * Test-only escape hatch to force a re-read on next loadMasterKey()
 * call. Not exported through any index. Do NOT call from production
 * code.
 */
export function _resetMasterKeyCacheForTests(): void {
  cached = null;
}
