import { randomBytes } from 'crypto';

export function generateSecureSessionID(length: number = 32): string {
  return randomBytes(length).toString('hex');
}
