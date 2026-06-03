import bcrypt from 'bcrypt';
import { MD5 } from 'crypto-js';

/**
 * Cost factor for new bcrypt hashes.
 *
 * Bumped from 10 to 12 to align with OWASP 2024 guidance for new
 * deployments — at cost 12, a single hash takes ~250ms on commodity
 * hardware, which keeps interactive login snappy while making
 * offline brute-force attacks against a leaked DB meaningfully
 * more expensive.
 *
 * bcrypt.compare() reads the cost from the hash prefix, so existing
 * cost-10 hashes still verify correctly. Users get an upgraded hash
 * on their next login (callers detect via isBcryptHashOutdated() and
 * re-hash).
 */
const BCRYPT_ROUNDS = 12;

/** Hash a password with bcrypt at the current cost factor. */
export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, BCRYPT_ROUNDS);

/**
 * Verify a password against a stored hash.
 * - bcrypt: any cost (10, 12, etc.) — handled transparently.
 * - legacy MD5: kept as a one-way fallback for users whose hashes
 *   pre-date the bcrypt migration. Should rarely fire.
 */
export const verifyPassword = (
  password: string,
  hash: string,
): Promise<boolean> => {
  if (hash.startsWith('$2b$') || hash.startsWith('$2a$')) {
    return bcrypt.compare(password, hash);
  }
  return Promise.resolve(MD5(password).toString() === hash);
};

/** True if the hash is already bcrypt (not legacy MD5). */
export const isBcryptHash = (hash: string): boolean =>
  hash.startsWith('$2b$') || hash.startsWith('$2a$');

/**
 * True if the bcrypt hash was generated with a cost lower than the
 * current `BCRYPT_ROUNDS`. Callers use this on successful login to
 * decide whether to re-hash and store an upgraded version.
 */
export const isBcryptHashOutdated = (hash: string): boolean => {
  if (!isBcryptHash(hash)) return false;
  // Hash shape: `$2b$<cost>$<...>`. The cost field is two digits.
  const cost = parseInt(hash.slice(4, 6), 10);
  return Number.isFinite(cost) && cost < BCRYPT_ROUNDS;
};
