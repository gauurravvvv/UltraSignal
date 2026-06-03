/**
 * UpdateSystemAdminValidation — validates PUT /system-admin/update.
 *
 * Authorisation is enforced upstream by `VerifyPermissionMiddleware('systemAdmin')`;
 * this middleware enforces payload shape, loads the target into
 * res.locals.systemAdmin, and checks for username/email uniqueness excluding the
 * current record (using NOT(id)) to allow no-op re-submits of the same value
 * without triggering a false "already exists" error.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { Not } from 'typeorm';
import { SYSTEM_CLIENT, CODE, IS_DEFAULT } from '../../../../config/config';
import {
  CLIENT,
  SYSTEM_ADMIN as SYSTEM_ADMIN_MSG } from '../../../shared/constants/response.messages';
import { User } from '../../../shared/db/entities/user.entity';
import { fields } from '../../../shared/utility/joi.schemas';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const schema = Joi.object({
  id: fields.id.required(),
  username: fields.username.required(),
  firstName: fields.firstName.required(),
  lastName: fields.lastName.required(),
  email: fields.email.required(),
  status: fields.status.optional(),
  justification: fields.justification.optional() });

const UpdateSystemAdminValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Validate & sanitize
  const { error, value } = validateSchema(schema, req.body);
  if (error) {
    return sendResponse(res, false, CODE.BAD_REQUEST, error);
  }
  req.body = value;

  const { id, username, email } = req.body;

  // Check if super admin exists
  try {
    const systemAdmin = await User.findOne({
      where: { id, clientName: SYSTEM_CLIENT.NAME } });

    if (!systemAdmin) {
      return sendResponse(
        res,
        false,
        CODE.NOT_FOUND,
        SYSTEM_ADMIN_MSG.NOT_FOUND,
      );
    }

    // Default (master_admin / bootstrap) system admin is fully immutable
    // through this endpoint. Mirrors the client-user invariant in
    // updateUser.validation.ts.
    if (systemAdmin.isDefault === IS_DEFAULT.YES) {
      return sendResponse(
        res,
        false,
        CODE.UNAUTHORIZED,
        SYSTEM_ADMIN_MSG.CANNOT_MODIFY_DEFAULT,
      );
    }

    res.locals.systemAdmin = systemAdmin;

    // Duplicate checks (excluding current record)
    const isSystemAdminExistsWithUsername = await User.findOne({
      where: { id: Not(id), username, clientName: SYSTEM_CLIENT.NAME } });

    if (isSystemAdminExistsWithUsername) {
      return sendResponse(
        res,
        false,
        CODE.ALREADY_EXISTS,
        SYSTEM_ADMIN_MSG.ALREADY_EXISTS_USERNAME,
      );
    }

    const isSystemAdminExistsWithEmail = await User.findOne({
      where: { id: Not(id), email, clientName: SYSTEM_CLIENT.NAME } });

    if (isSystemAdminExistsWithEmail) {
      return sendResponse(
        res,
        false,
        CODE.ALREADY_EXISTS,
        SYSTEM_ADMIN_MSG.ALREADY_EXISTS_EMAIL,
      );
    }
  } catch (err) {
    return sendResponse(res, false, CODE.BAD_REQUEST, CLIENT.INVALID_ID);
  }

  next();
};

export default UpdateSystemAdminValidation;
