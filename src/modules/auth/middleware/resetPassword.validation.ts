/**
 * ResetPasswordValidation — validates POST /auth/reset body.
 * The OTP is a short numeric code sent via email; password strength
 * is enforced by the shared `fields.password` schema.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import { fields } from '../../../shared/utility/joi.schemas';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const ResetPasswordValidation = async (
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
    otp: fields.otp.required(),
    password: fields.password.required(),
  });

  const { error, value } = validateSchema(schema, req.body);
  if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);

  req.body = value;
  next();
};

export default ResetPasswordValidation;
