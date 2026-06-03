/**
 * deleteUserBulk — batch version of deleteUser with the same cascade semantics.
 *
 * UserGroupMapping and DatasourceAccess use `In(ids)` to hard-delete all
 * affected rows in two statements rather than per-user loops — this avoids
 * N×2 round-trips for large batches.
 *
 * The User soft-delete loop is sequential because TypeORM's softRemove stamps
 * each row with an individual `deletedOn` timestamp — a bulk softRemove would
 * share a single timestamp, which is not meaningful for audit.
 */
import { Request, Response } from 'express';
import { EntityManager, In } from 'typeorm';
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

const deleteUserBulk = async (req: Request, res: Response) => {
  Logger.info(`Bulk delete user request`);

  const { loggedInId, orgUsers } = res.locals;

  try {
    const ids: string[] = orgUsers.map((u: any) => u.id);

    await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        await manager
          .getRepository(UserGroupMapping)
          .delete({ userId: In(ids) });
        await manager
          .getRepository(DatasourceAccess)
          .delete({ userId: In(ids) });

        for (const orgUser of orgUsers) {
          orgUser.deletedBy = loggedInId;
          await manager.getRepository(User).save(orgUser);
          await manager.getRepository(User).softRemove(orgUser);
        }
      },
    );

    const deletedIds: string[] = orgUsers.map((u: any) => u.id);

    sendResponse(res, true, CODE.SUCCESS, USER_MSG.BULK_DELETED, {
      deletedCount: deletedIds.length,
      deletedIds,
    });
  } catch (error) {
    Logger.error(`Error while bulk deleting users: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default deleteUserBulk;
