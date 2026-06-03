/**
 * GetSystemAdminValidation — validates GET /system-admin/get/:id and PUT /unlock/:id.
 *
 * Authorisation is enforced upstream by `VerifyPermissionMiddleware('systemAdmin')`;
 * this middleware fetches and pre-loads the target system admin entity into
 * res.locals.systemAdmin so downstream handlers (getSystemAdmin, unlockSystemAdmin)
 * have no DB work to do.
 */
import { NextFunction, Request, Response } from 'express';
import { SYSTEM_CLIENT, CODE, VALIDATION_MESSAGES } from '../../../../config/config';
import {
  CLIENT,
  SYSTEM_ADMIN as SYSTEM_ADMIN_MSG } from '../../../shared/constants/response.messages';
import { User } from '../../../shared/db/entities/user.entity';
import sendResponse from '../../../shared/utility/response';

// Define a middleware function for getSystemAdmin.
const GetSystemAdminValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { id } = req.params;

  if (!id) {
    return sendResponse(
      res,
      false,
      CODE.BAD_REQUEST,
      VALIDATION_MESSAGES.ID.REQUIRED,
    );
  }

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

    res.locals.systemAdmin = systemAdmin;
  } catch (err) {
    return sendResponse(res, false, CODE.BAD_REQUEST, CLIENT.INVALID_ID);
  }

  next();
};

export default GetSystemAdminValidation;
