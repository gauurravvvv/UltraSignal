/**
 * unlockSystemAdmin — clears an account lock triggered by repeated login failures.
 *
 * Account locking is set automatically by the login handler after maxLoginAttempts
 * consecutive failures. The only way to unlock is through this explicit admin action
 * (there is no time-based auto-unlock) so the security team always has visibility.
 *
 * Clearing accountLockedAt and resetting failedLoginAttempts to 0 is the full
 * unlock; the user can log in normally again immediately after.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  SYSTEM_ADMIN as SYSTEM_ADMIN_MSG,
} from '../../../shared/constants/response.messages';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const unlockSystemAdmin = async (req: Request, res: Response) => {
  Logger.info(`Unlock super admin request`);

  const { systemAdmin } = res.locals;

  try {
    if (!systemAdmin.accountLockedAt) {
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        SYSTEM_ADMIN_MSG.ACCOUNT_NOT_LOCKED,
      );
    }

    systemAdmin.accountLockedAt = null;
    systemAdmin.failedLoginAttempts = 0;
    await systemAdmin.save();

    sendResponse(res, true, CODE.SUCCESS, SYSTEM_ADMIN_MSG.ACCOUNT_UNLOCKED);
  } catch (error) {
    Logger.error(`Error in unlockSystemAdmin: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default unlockSystemAdmin;
