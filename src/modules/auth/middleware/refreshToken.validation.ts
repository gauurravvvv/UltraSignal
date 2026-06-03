/**
 * RefreshTokenValidation — validates POST /auth/refresh body.
 * Both fields are required: the opaque refresh token and the client name
 * (needed to route to the correct DB when looking up the token).
 * The client name is sent in the body as `client`.
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
    client: Joi.string().trim().required().messages({
      'string.empty': 'Client is required',
      'any.required': 'Client is required',
    }),
  });

  const { error, value } = validateSchema(schema, req.body);
  if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);

  req.body = value;
  next();
};

export default RefreshTokenValidation;
