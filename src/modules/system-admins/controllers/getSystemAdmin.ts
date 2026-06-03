/**
 * getSystemAdmin — returns a single system admin with computed UI flags.
 *
 * The entity is pre-fetched and stored in res.locals.systemAdmin by
 * GetSystemAdminValidation, so this handler has no DB work to do.
 * It only decorates the entity with canDelete/isLocked before returning,
 * keeping the same shape as the list endpoint for consistency.
 */
import { Request, Response } from 'express';
import { CODE, IS_DEFAULT } from '../../../../config/config';
import { SYSTEM_ADMIN as SYSTEM_ADMIN_MSG } from '../../../shared/constants/response.messages';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const getSystemAdmin = async (req: Request, res: Response) => {
  Logger.info(`Get super admin request`);

  const { systemAdmin, loggedInId } = res.locals;

  const systemAdminWithCanDelete = {
    ...systemAdmin,
    canDelete:
      systemAdmin.isDefault !== IS_DEFAULT.YES && systemAdmin.id !== loggedInId,
    isLocked: !!systemAdmin.accountLockedAt,
  };

  sendResponse(
    res,
    true,
    CODE.SUCCESS,
    SYSTEM_ADMIN_MSG.FETCHED,
    systemAdminWithCanDelete,
  );
};

export default getSystemAdmin;
