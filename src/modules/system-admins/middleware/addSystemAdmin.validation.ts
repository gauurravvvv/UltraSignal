/**
 * AddSystemAdminValidation — validates POST /system-admin/add.
 *
 * Authorisation is enforced upstream by `VerifyPermissionMiddleware('systemAdmin')`
 * in the system-admins router; this middleware is now payload-only. It checks
 * uniqueness of email and username across existing system admin accounts before
 * the controller runs so the controller stays focused on creation logic.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { SYSTEM_CLIENT, CODE } from '../../../../config/config';
import {
  GENERIC,
  SYSTEM_ADMIN as SYSTEM_ADMIN_MSG } from '../../../shared/constants/response.messages';
import { User } from '../../../shared/db/entities/user.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { fields } from '../../../shared/utility/joi.schemas';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const schema = Joi.object({
  email: fields.email.required(),
  username: fields.username.required(),
  firstName: fields.firstName.required(),
  lastName: fields.lastName.required() });

const AddSystemAdminValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Validate & sanitize (trim, lowercase email, strip unknown fields)
    const { error, value } = validateSchema(schema, req.body);
    if (error) {
      return sendResponse(res, false, CODE.BAD_REQUEST, error);
    }
    req.body = value;

    const { email, username } = req.body;

    // Duplicate checks
    const isAdminExistsByEmail = await User.findOne({
      where: [{ email, clientName: SYSTEM_CLIENT.NAME }] });

    if (isAdminExistsByEmail) {
      return sendResponse(
        res,
        false,
        CODE.ALREADY_EXISTS,
        SYSTEM_ADMIN_MSG.ALREADY_EXISTS_EMAIL,
      );
    }

    const isAdminExistsByUsername = await User.findOne({
      where: [{ username, clientName: SYSTEM_CLIENT.NAME }] });

    if (isAdminExistsByUsername) {
      return sendResponse(
        res,
        false,
        CODE.ALREADY_EXISTS,
        SYSTEM_ADMIN_MSG.ALREADY_EXISTS_USERNAME,
      );
    }

    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default AddSystemAdminValidation;
