import { randomInt } from 'crypto';
import jwt from 'jsonwebtoken';
import { JWT_SECRET_KEY } from '../../../config/config';

export const createToken = (data: any, expiresIn?: string | number) => {
  const options: jwt.SignOptions = {};
  if (expiresIn) {
    options.expiresIn = expiresIn as jwt.SignOptions['expiresIn'];
  }
  return jwt.sign({ ...data }, JWT_SECRET_KEY, options);
};

export const generateResetPassLink = (): string => {
  return randomInt(100000, 1000000).toString();
};
