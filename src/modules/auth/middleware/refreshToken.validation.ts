/**
 * RefreshTokenValidation — validates POST /auth/refresh body.
 * Both fields are required: the opaque refresh token and the org name
 * (needed to route to the correct DB when looking up the token).
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
    organisation: Joi.string().trim().required().messages({
      'string.empty': 'Organisation is required',
      'any.required': 'Organisation is required',
    }),
  });

  const { error, value } = validateSchema(schema, req.body);
  if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);

  req.body = value;
  next();
};

export default RefreshTokenValidation;
