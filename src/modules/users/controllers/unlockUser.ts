/**
 * unlockUser — clears the lockout state set by the failed-login policy.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  USER as USER_MSG,
} from '../../../shared/constants/response.messages';
import { User } from '../../../shared/db/entities/user.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { AppDataSource } from '../../../shared/db';

const unlockUser = async (req: Request, res: Response) => {
  Logger.info(`Unlock user request`);

  const { orgUser } = res.locals;

  try {
    if (!orgUser.accountLockedAt) {
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        USER_MSG.ACCOUNT_NOT_LOCKED,
      );
    }

    orgUser.accountLockedAt = null;
    orgUser.failedLoginAttempts = 0;
    await AppDataSource.getRepository(User).save(orgUser);

    sendResponse(res, true, CODE.SUCCESS, USER_MSG.ACCOUNT_UNLOCKED);
  } catch (error) {
    Logger.error(`Error in unlockUser: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default unlockUser;
