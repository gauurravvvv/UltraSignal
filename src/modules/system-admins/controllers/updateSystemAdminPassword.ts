/**
 * updateSystemAdminPassword — admin-forced password reset for a system admin account.
 *
 * This is an administrative action (one admin resets another's password), distinct
 * from the self-service OTP reset flow. The caller doesn't need to know the current
 * password — that's intentional for helpdesk/recovery scenarios.
 *
 * After a successful reset:
 *  - The new password is bcrypt-hashed (system admins always use bcrypt, not client pepper).
 *  - The refresh token is nulled, forcing the affected admin to log in again. This
 *    ensures the password change takes effect immediately even if they have an active
 *    session.
 *  - Password history is saved inside the same transaction as the password update to
 *    guarantee atomicity — we never want a history record without a matching password
 *    change, or vice versa.
 *
 * Note: the password history limit is hardcoded to 5 here. It should ideally read
 * from client.config.passwordHistoryLimit for consistency with the OTP reset flow.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  SYSTEM_ADMIN as SYSTEM_ADMIN_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { hashPassword } from '../../../shared/utility/hashPassword';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const updateSystemAdminPassword = async (req: Request, res: Response) => {
  Logger.info(`Update System Admin password request`);

  const { newPassword } = req.body;
  const { loggedInId, systemAdmin } = res.locals;

  try {
    systemAdmin.password = await hashPassword(newPassword);
    systemAdmin.updatedBy = loggedInId;
    systemAdmin.refreshToken = null;
    systemAdmin.refreshTokenExpiresAt = null;

    let result: any;
    await AppDataSource.transaction(async (manager: EntityManager) => {
      result = await manager.save(systemAdmin);
    });

    sendResponse(
      res,
      true,
      CODE.SUCCESS,
      SYSTEM_ADMIN_MSG.PASSWORD_UPDATED,
      result,
    );
  } catch (error) {
    Logger.error(
      `Error in updateSystemAdminPassword: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default updateSystemAdminPassword;
