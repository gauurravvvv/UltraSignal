import { EntityManager } from 'typeorm';
import { AppDataSource } from '../db';
import { PasswordHistory as PasswordHistoryMaster } from '../db/entities/passwordHistory.entity';
import { PasswordHistory as PasswordHistoryShared } from '../db/entities/passwordHistory.entity';
import { decryptForClient } from '../services/crypto.service';
import { verifyPassword } from './hashPassword';

// ── System Admin (bcrypt, env DB) ──

export async function isPasswordReusedMaster(
  userId: string,
  newPassword: string,
  currentEncryptedPassword?: string,
  limit: number = 5,
  manager?: EntityManager,
): Promise<boolean> {
  // Check against current password (covers pre-deployment passwords not yet in history)
  if (
    currentEncryptedPassword &&
    (await verifyPassword(newPassword, currentEncryptedPassword))
  ) {
    return true;
  }

  const repo = manager
    ? manager.getRepository(PasswordHistoryMaster)
    : AppDataSource.getRepository(PasswordHistoryMaster);

  const history = await repo.find({
    where: { userId },
    order: { createdOn: 'DESC' },
    take: limit,
  });

  for (const entry of history) {
    if (await verifyPassword(newPassword, entry.password)) return true;
  }
  return false;
}

export async function savePasswordHistoryMaster(
  userId: string,
  encryptedPassword: string,
  limit: number = 5,
  manager?: EntityManager,
): Promise<void> {
  const repo = manager
    ? manager.getRepository(PasswordHistoryMaster)
    : AppDataSource.getRepository(PasswordHistoryMaster);

  const entry = repo.create({ userId, password: encryptedPassword });
  await repo.save(entry);

  // Prune entries older than the limit
  const history = await repo.find({
    where: { userId },
    order: { createdOn: 'DESC' },
  });

  if (history.length > limit) {
    const toDelete = history.slice(limit);
    await repo.remove(toDelete);
  }
}

// ── Client Admin / User (AES peppered, client master DB) ──

export async function isPasswordReusedShared(
  manager: EntityManager,
  userId: string,
  newPassword: string,
  clientConfig: { encryptedDek?: string | null },
  currentEncryptedPassword?: string,
  limit: number = 5,
): Promise<boolean> {
  // Check against current password (covers pre-deployment passwords
  // not yet in history). decryptForClient throws on bad keys / corrupt
  // ciphertext; we swallow that and treat as "no reuse" so a single
  // corrupt history row doesn't lock the user out.
  if (currentEncryptedPassword) {
    try {
      const decrypted = decryptForClient(
        currentEncryptedPassword,
        clientConfig,
      );
      if (decrypted === newPassword) {
        return true;
      }
    } catch {
      /* ignore */
    }
  }

  const repo = manager.getRepository(PasswordHistoryShared);

  const history = await repo.find({
    where: { userId },
    order: { createdOn: 'DESC' },
    take: limit,
  });

  return history.some(entry => {
    try {
      const decrypted = decryptForClient(entry.password, clientConfig);
      return decrypted === newPassword;
    } catch {
      return false;
    }
  });
}

export async function savePasswordHistoryShared(
  manager: EntityManager,
  userId: string,
  encryptedPassword: string,
  limit: number = 5,
): Promise<void> {
  const repo = manager.getRepository(PasswordHistoryShared);

  const entry = repo.create({ userId, password: encryptedPassword });
  await repo.save(entry);

  // Prune entries older than the limit
  const history = await repo.find({
    where: { userId },
    order: { createdOn: 'DESC' },
  });

  if (history.length > limit) {
    const toDelete = history.slice(limit);
    await repo.remove(toDelete);
  }
}
