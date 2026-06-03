import crypto from 'crypto';
import { getErrorMessage } from './getErrorMessage';
import Logger from './logger/logger';

function getKeyIvSize(algorithm: string): { keySize: number; ivSize: number } {
  const keyIvMap: Record<string, { keySize: number; ivSize: number }> = {
    'aes-256-gcm': { keySize: 32, ivSize: 12 },
    'aes-192-gcm': { keySize: 24, ivSize: 12 },
    'aes-128-gcm': { keySize: 16, ivSize: 12 },
    'aes-256-cbc': { keySize: 32, ivSize: 16 },
    'aes-192-cbc': { keySize: 24, ivSize: 16 },
    'aes-128-cbc': { keySize: 16, ivSize: 16 },
  };

  if (!(algorithm in keyIvMap)) {
    throw new Error('Unsupported encryption algorithm');
  }

  return keyIvMap[algorithm];
}

function deriveKey(algorithm: string, pepper: string): Buffer {
  const { keySize } = getKeyIvSize(algorithm);
  return crypto
    .createHash('sha256')
    .update(pepper)
    .digest()
    .subarray(0, keySize);
}

export function decryptPepperedText(
  encryptedText: string,
  algorithm: string,
  pepper: string,
): string {
  try {
    const key = deriveKey(algorithm, pepper);
    const parts = encryptedText.split(':');

    if (!parts || parts.length < 2) {
      throw new Error('Invalid encrypted text format');
    }

    const iv = Buffer.from(parts[0], 'hex');

    if (algorithm.includes('gcm')) {
      if (parts.length !== 3) {
        throw new Error('Invalid GCM encrypted text format');
      }

      const authTag = Buffer.from(parts[1], 'hex');
      const encryptedData = parts[2];

      const decipher = crypto.createDecipheriv(
        algorithm,
        key,
        iv,
      ) as crypto.DecipherGCM;

      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } else {
      const encryptedData = parts[1];
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }
  } catch (error) {
    Logger.error(`Decryption error: ${getErrorMessage(error)}`);
    throw new Error(`Decryption failed: ${getErrorMessage(error)}`);
  }
}
