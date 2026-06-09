/**
 * Password-history helpers — enforce no-reuse of the N most-recent
 * passwords for a user. Stored ciphertext is the same shape as
 * user.password (encryptForClient output). Comparison is
 * decrypt-then-string-equal; one corrupt history row is swallowed
 * rather than locking the user out.
 *
 * Both helpers take an EntityManager so the caller can scope them
 * inside the same transaction that writes the new user.password.
 */
import { EntityManager } from 'typeorm';
import { ClientConfig } from '../db/entities/clientConfig.entity';
import { PasswordHistory } from '../db/entities/passwordHistory.entity';
import { decryptForClient } from '../services/crypto.service';
import Logger from './logger/logger';

export async function isPasswordReused(
  manager: EntityManager,
  userId: string,
  newPassword: string,
  clientConfig: ClientConfig,
  currentEncryptedPassword?: string | null,
  limit: number = 5,
): Promise<boolean> {
  // Check against the current password first — covers passwords that
  // were set before the history table existed and never made it into
  // PasswordHistory.
  if (currentEncryptedPassword) {
    try {
      if (decryptForClient(currentEncryptedPassword, clientConfig) === newPassword) {
        return true;
      }
    } catch (err) {
      // Treat as no match — don't lock the user out over one bad row.
      Logger.warn(`isPasswordReused: current-password decrypt failed for user=${userId}`);
    }
  }

  const repo = manager.getRepository(PasswordHistory);
  const history = await repo.find({
    where: { userId },
    order: { createdOn: 'DESC' },
    take: limit,
  });

  for (const entry of history) {
    try {
      if (decryptForClient(entry.password, clientConfig) === newPassword) {
        return true;
      }
    } catch (err) {
      // Same defensive swallow as above.
      Logger.warn(`isPasswordReused: history row decrypt failed for user=${userId} row=${entry.id}`);
    }
  }
  return false;
}

export async function savePasswordHistory(
  manager: EntityManager,
  userId: string,
  encryptedPassword: string,
  limit: number = 5,
): Promise<void> {
  const repo = manager.getRepository(PasswordHistory);

  const entry = repo.create({ userId, password: encryptedPassword });
  await repo.save(entry);

  // Prune anything beyond `limit` — keep the N most recent.
  const history = await repo.find({
    where: { userId },
    order: { createdOn: 'DESC' },
  });
  if (history.length > limit) {
    await repo.remove(history.slice(limit));
  }
}
