/**
 * SetPasswordValidation — validates POST /auth/set-password body.
 * The setup token must be the raw 64-char hex string from the welcome
 * email link. For org users the controller decrypts it server-side;
 * for system admins it's stored in plain text.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import { fields } from '../../../shared/utility/joi.schemas';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const SetPasswordValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const schema = Joi.object({
    id: fields.id.required().messages({
      'any.required': 'User ID is required',
    }),
    orgId: fields.id.required().messages({
      'any.required': 'Organisation ID is required',
    }),
    token: Joi.string().hex().length(64).required().messages({
      'string.empty': 'Setup token is required',
      'string.hex': 'Invalid setup token format',
      'string.length': 'Invalid setup token format',
      'any.required': 'Setup token is required',
    }),
    password: fields.password.required(),
  });

  const { error, value } = validateSchema(schema, req.body);
  if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);

  req.body = value;
  next();
};

export default SetPasswordValidation;
