/**
 * UpdatePasswordValidation — validates PUT /system-admin/update/password.
 *
 * Authorisation is enforced upstream by `VerifyPermissionMiddleware('systemAdmin')`;
 * this middleware enforces payload shape, fetches the target admin, and pre-loads
 * res.locals.systemAdmin. The controller then handles password history checks
 * and bcrypt hashing.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { SYSTEM_ORGANISATION, CODE } from '../../../../config/config';
import {
  ORGANISATION,
  SYSTEM_ADMIN as SYSTEM_ADMIN_MSG } from '../../../shared/constants/response.messages';
import { User } from '../../../shared/db/entities/user.entity';
import { fields } from '../../../shared/utility/joi.schemas';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const schema = Joi.object({
  id: fields.id.required(),
  newPassword: fields.password.required().messages({
    'any.required': 'New password is required',
    'string.empty': 'New password is required' }) });

const UpdatePasswordValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { error, value } = validateSchema(schema, req.body);
  if (error) {
    return sendResponse(res, false, CODE.BAD_REQUEST, error);
  }
  req.body = value;

  const { id } = req.body;

  // Check if super admin exists
  try {
    const systemAdmin = await User.findOne({
      where: { id, organisationName: SYSTEM_ORGANISATION.NAME } });

    if (!systemAdmin) {
      return sendResponse(
        res,
        false,
        CODE.NOT_FOUND,
        SYSTEM_ADMIN_MSG.NOT_FOUND,
      );
    }

    res.locals.systemAdmin = systemAdmin;
  } catch (err) {
    return sendResponse(res, false, CODE.BAD_REQUEST, ORGANISATION.INVALID_ID);
  }

  next();
};

export default UpdatePasswordValidation;
