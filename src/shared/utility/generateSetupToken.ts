import { randomBytes } from 'crypto';

export function generateSetupToken(): string {
  return randomBytes(32).toString('hex');
}
