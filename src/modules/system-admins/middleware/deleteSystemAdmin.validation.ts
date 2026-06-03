/**
 * DeleteSystemAdminValidation — validates DELETE /system-admin/delete/:id.
 *
 * Authorisation is enforced upstream by `VerifyPermissionMiddleware('systemAdmin')`;
 * this middleware is now payload-only. Guards:
 *  - Self-deletion blocked: an admin cannot remove their own account.
 *  - Default-admin blocked: the bootstrap admin (isDefault=1) is protected and
 *    cannot be deleted through the API. This prevents accidental loss of the
 *    initial system access account.
 *
 * Pre-loads res.locals.systemAdmin for the controller.
 */
import { NextFunction, Request, Response } from 'express';
import { SYSTEM_CLIENT, CODE,
  IS_DEFAULT,
  VALIDATION_MESSAGES } from '../../../../config/config';
import {
  CLIENT,
  SYSTEM_ADMIN as SYSTEM_ADMIN_MSG } from '../../../shared/constants/response.messages';
import { User } from '../../../shared/db/entities/user.entity';
import sendResponse from '../../../shared/utility/response';

// Define a middleware function for deleteSystemAdmin.
const DeleteSystemAdminValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { loggedInId } = res.locals;

  const { id } = req.params;

  if (!id) {
    return sendResponse(
      res,
      false,
      CODE.BAD_REQUEST,
      VALIDATION_MESSAGES.ID.REQUIRED,
    );
  }

  if (loggedInId == id) {
    return sendResponse(
      res,
      false,
      CODE.BAD_REQUEST,
      'You cannot delete yourself',
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

    if (systemAdmin.isDefault === IS_DEFAULT.YES) {
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        SYSTEM_ADMIN_MSG.CANNOT_DELETE_DEFAULT,
      );
    }

    res.locals.systemAdmin = systemAdmin;
  } catch (err) {
    return sendResponse(res, false, CODE.BAD_REQUEST, CLIENT.INVALID_ID);
  }

  next();
};

export default DeleteSystemAdminValidation;
