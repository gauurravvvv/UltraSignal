/**
 * deleteUser — cascades hard-deletes to UserGroupMapping and DatasourceAccess,
 * then soft-deletes the User entity within a single transaction.
 *
 * UserGroupMapping and DatasourceAccess are hard-deleted because keeping
 * orphaned access/membership records after user removal would require
 * excluding deleted users from every access-check query. Soft-delete on
 * the User itself preserves the account for audit history.
 *
 * `deletedBy` is set before softRemove so the audit identity survives in the
 * soft-deleted row even after the normal `updatedBy` field is no longer visible.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  USER as USER_MSG,
} from '../../../shared/constants/response.messages';
import { DatasourceAccess } from '../../../shared/db/entities/datasource_access.entity';
import { UserGroupMapping } from '../../../shared/db/entities/user-group-mapping.entity';
import { User } from '../../../shared/db/entities/user.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { AppDataSource } from '../../../shared/db';

const deleteUser = async (req: Request, res: Response) => {
  Logger.info(`Delete user request`);

  const { loggedInId, orgUser } = res.locals;

  try {
    await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        await manager
          .getRepository(UserGroupMapping)
          .delete({ userId: orgUser.id });
        await manager
          .getRepository(DatasourceAccess)
          .delete({ userId: orgUser.id });
        orgUser.deletedBy = loggedInId;
        await manager.getRepository(User).save(orgUser);
        await manager.getRepository(User).softRemove(orgUser);
      },
    );

    sendResponse(res, true, CODE.SUCCESS, USER_MSG.DELETED);
  } catch (error) {
    Logger.error(`Error while deleting user: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default deleteUser;
