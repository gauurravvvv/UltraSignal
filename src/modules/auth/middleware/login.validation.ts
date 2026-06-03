/**
 * LoginValidation — sanitizes and validates POST /auth/login body.
 * Strips unknown fields so the controller only sees trusted input.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import { fields } from '../../../shared/utility/joi.schemas';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const LoginValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const schema = Joi.object({
    organisation: Joi.string().trim().required().messages({
      'string.empty': 'Organisation is required',
      'any.required': 'Organisation is required',
    }),
    username: fields.username.required(),
    password: Joi.string().required().messages({
      'string.empty': 'Password is required',
      'any.required': 'Password is required',
    }),
    rememberMe: Joi.boolean().optional(),
  });

  const { error, value } = validateSchema(schema, req.body);
  if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);

  req.body = value;
  next();
};

export default LoginValidation;
