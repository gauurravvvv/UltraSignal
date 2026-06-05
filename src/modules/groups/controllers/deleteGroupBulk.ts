/**
 * deleteGroupBulk — deletes multiple groups and their dependents in one transaction.
 *
 * UserGroupMapping rows for all groups are deleted with `groupId IN (ids)` in one
 * statement, then each group is individually soft-deleted in the loop. The soft-delete
 * loop is sequential because TypeORM's `softRemove` needs each entity's `deletedOn`
 * timestamp set individually.
 */
import { Request, Response } from 'express';
import { EntityManager, In } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  GROUP as GROUP_MSG,
} from '../../../shared/constants/response.messages';
import { Group } from '../../../shared/db/entities/group.entity';
import { UserGroupMapping } from '../../../shared/db/entities/user-group-mapping.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { AppDataSource } from '../../../shared/db';

const deleteGroupBulk = async (req: Request, res: Response) => {
  Logger.info(`Bulk delete Group request`);

  const { loggedInId, groups } = res.locals;

  try {
    const ids: string[] = groups.map((g: any) => g.id);

    await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        await manager
          .getRepository(UserGroupMapping)
          .delete({ groupId: In(ids) });

        for (const group of groups) {
          group.deletedBy = loggedInId;
          await manager.getRepository(Group).save(group);
          await manager.getRepository(Group).softRemove(group);
        }
      },
    );

    const deletedIds: string[] = groups.map((g: Group) => g.id);

    sendResponse(res, true, CODE.SUCCESS, GROUP_MSG.BULK_DELETED, {
      deletedCount: deletedIds.length,
      deletedIds,
    });
  } catch (error) {
    Logger.error(`Error while bulk deleting groups: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default deleteGroupBulk;
