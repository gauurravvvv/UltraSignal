/**
 * updateGroup — replaces the full member list atomically alongside group metadata changes.
 *
 * UserGroupMapping rows for the group are deleted and re-inserted on every update,
 * rather than diffing adds/removes. This is simpler and correct because the UI
 * always sends the complete desired member set — a diff-and-patch approach would
 * require tracking order and identity, which adds complexity without benefit.
 *
 * The delete + insert runs inside a transaction so the group is never in a
 * temporarily empty state visible to concurrent readers.
 *
 * Role immutability is enforced in middleware — the controller trusts that
 * `res.locals.group.roleId` has not changed.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
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

const updateGroup = async (req: Request, res: Response) => {
  Logger.info(`Update Group request`);

  const { id, name, status, description, users } = req.body;
  const { loggedInId, group } = res.locals;

  try {
    group.name = name ? name : group.name;
    group.description = description ? description : group.description;
    group.status = status;
    group.updatedBy = loggedInId;

    let result!: Group;
    await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        await manager.getRepository(UserGroupMapping).delete({ groupId: id });

        if (users.length > 0) {
          const mappings = users.map((uId: string) => ({
            userId: uId,
            groupId: id,
          }));
          await manager.getRepository(UserGroupMapping).insert(mappings);
        }

        result = await manager.getRepository(Group).save(group);
      },
    );

    sendResponse(res, true, CODE.SUCCESS, GROUP_MSG.UPDATED, result);
  } catch (error) {
    Logger.error(`Error updating group: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default updateGroup;
