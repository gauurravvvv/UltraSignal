/**
 * ChangePasswordValidation — validates the new password field for self-service password
 * changes by the currently authenticated user.
 *
 * No client or user ID validation is needed here because the controller derives the target
 * user from the JWT token in `res.locals.loggedInId` — the endpoint is inherently
 * self-scoped and cannot be used to change another user's password.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import { fields } from '../../../shared/utility/joi.schemas';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const schema = Joi.object({
  newPassword: fields.password.required().messages({
    'any.required': 'New password is required',
    'string.empty': 'New password is required',
  }),
});

const ChangePasswordValidation = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { error, value } = validateSchema(schema, req.body);
  if (error) {
    return sendResponse(res, false, CODE.BAD_REQUEST, error);
  }
  req.body = value;
  next();
};

export default ChangePasswordValidation;
