/**
 * VerifySetupTokenValidation — validates POST /auth/verify-setup-token body.
 * Same token format as set-password (64-char hex) but no password field —
 * this endpoint is read-only; it just tells the FE whether to render the form.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import { fields } from '../../../shared/utility/joi.schemas';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const VerifySetupTokenValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const schema = Joi.object({
    id: fields.id.required().messages({
      'any.required': 'User ID is required',
    }),
    clientId: fields.id.required().messages({
      'any.required': 'Client ID is required',
    }),
    token: Joi.string().hex().length(64).required().messages({
      'string.empty': 'Setup token is required',
      'string.hex': 'Invalid setup token format',
      'string.length': 'Invalid setup token format',
      'any.required': 'Setup token is required',
    }),
  });

  const { error, value } = validateSchema(schema, req.body);
  if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);

  req.body = value;
  next();
};

export default VerifySetupTokenValidation;
