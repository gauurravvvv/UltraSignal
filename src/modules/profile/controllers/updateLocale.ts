/**
 * updateLocale — updates the UI locale preference for the logged-in user.
 *
 * Branches on role for the same reason as `changePassword` and `getProfile`: system
 * admins are stored in the master DB while org users are in the per-org shared DB.
 * The locale field is user-scoped so no org-level config or encryption is needed.
 */
import { Request, Response } from 'express';
import { CODE, ROLES } from '../../../../config/config';
import {
  GENERIC,
  PROFILE as PROFILE_MSG,
  USER as USER_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { User as MasterUser } from '../../../shared/db/entities/user.entity';
import { User as SharedUser } from '../../../shared/db/entities/user.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const updateLocale = async (req: Request, res: Response) => {
  Logger.info('Update locale request');

  const { locale } = req.body;
  const { loggedInId, loggedInRole } = res.locals;

  try {
    if (loggedInRole === ROLES.SYSTEM_ADMIN) {
      const user = await AppDataSource.getRepository(MasterUser).findOne({
        where: { id: loggedInId },
      });

      if (!user) {
        return sendResponse(res, false, CODE.NOT_FOUND, USER_MSG.NOT_FOUND);
      }

      user.locale = locale;
      user.updatedBy = loggedInId;
      await AppDataSource.getRepository(MasterUser).save(user);
    } else {
      const user = await AppDataSource
        .getRepository(SharedUser)
        .findOne({ where: { id: loggedInId } });

      if (!user) {
        return sendResponse(res, false, CODE.NOT_FOUND, USER_MSG.NOT_FOUND);
      }

      user.locale = locale;
      user.updatedBy = loggedInId;
      await AppDataSource.getRepository(SharedUser).save(user);
    }

    sendResponse(res, true, CODE.SUCCESS, PROFILE_MSG.LOCALE_UPDATED, {
      locale,
    });
  } catch (error) {
    Logger.error(`Error updating locale: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default updateLocale;
