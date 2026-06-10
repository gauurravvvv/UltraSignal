/**
 * RefreshTokenValidation — validates POST /auth/refresh body.
 *
 * Only the opaque refresh token is required. The token is a 32-byte
 * random hex string — globally unique — so it identifies the user (and
 * therefore the client) without any FE-supplied tenant identifier. The
 * controller reads `user.clientId` / `user.clientName` off the matched
 * row to mint the new JWT.
 *
 * Aligns with the rest of the codebase's "FE never names a client"
 * principle; the sanitizer would strip a `client` field anyway on every
 * other route.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const RefreshTokenValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const schema = Joi.object({
    refreshToken: Joi.string().trim().required().messages({
      'string.empty': 'Refresh token is required',
      'any.required': 'Refresh token is required',
    }),
  });

  const { error, value } = validateSchema(schema, req.body);
  if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);

  req.body = value;
  next();
};

export default RefreshTokenValidation;
