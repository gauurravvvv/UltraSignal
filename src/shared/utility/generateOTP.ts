import { randomBytes } from 'crypto';

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // excludes 0/O, 1/I/L to avoid ambiguity

export function GENERATE_OTP(length: number = 6): string {
  const bytes = randomBytes(length);
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += CHARSET[bytes[i] % CHARSET.length];
  }
  return otp;
}
