/**
 * getUser — returns the pre-loaded user with computed UI-facing fields.
 *
 * `canEdit`, `canDelete`, and `isLocked` are derived here rather than stored
 * on the entity so the client doesn't need to replicate the business rules.
 * A user is non-mutable (canEdit / canDelete both false) when:
 *   - `isDefault === 1` — system-seeded "master" admin, OR
 *   - the row IS the caller — users shouldn't edit or delete themselves
 *     from the user management screen.
 */
import { Request, Response } from 'express';
import { CODE, IS_DEFAULT } from '../../../../config/config';
import { USER as USER_MSG } from '../../../shared/constants/response.messages';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const getUser = async (req: Request, res: Response) => {
  Logger.info(`Get client user request`);

  const { orgUser, loggedInId } = res.locals;

  const isMutable =
    orgUser.isDefault !== IS_DEFAULT.YES && orgUser.id !== loggedInId;

  const orgUserWithMeta = {
    ...orgUser,
    canEdit: isMutable,
    canDelete: isMutable,
    isLocked: !!orgUser.accountLockedAt,
  };

  sendResponse(res, true, CODE.SUCCESS, USER_MSG.FETCHED, orgUserWithMeta);
};

export default getUser;
