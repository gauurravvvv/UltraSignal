/**
 * getUser — returns the pre-loaded user with two computed UI-facing fields.
 *
 * `canDelete` and `isLocked` are derived here rather than stored on the entity
 * so the client doesn't need to replicate the business rule (isDefault === 1
 * means system-seeded; accountLockedAt non-null means locked by failed-login
 * policy). Saves a round-trip for the admin interface.
 */
import { Request, Response } from 'express';
import { CODE, IS_DEFAULT } from '../../../../config/config';
import { USER as USER_MSG } from '../../../shared/constants/response.messages';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const getUser = async (req: Request, res: Response) => {
  Logger.info(`Get client user request`);

  const { orgUser } = res.locals;

  const orgUserWithCanDelete = {
    ...orgUser,
    canDelete: orgUser.isDefault !== IS_DEFAULT.YES,
    isLocked: !!orgUser.accountLockedAt,
  };

  sendResponse(res, true, CODE.SUCCESS, USER_MSG.FETCHED, orgUserWithCanDelete);
};

export default getUser;
