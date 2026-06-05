/**
 * deleteGroup — cascades hard-deletes to member mappings, then
 * soft-deletes the group itself.
 *
 * UserGroupMapping rows are hard-deleted (no soft-delete needed) because
 * group membership is operational state with no recovery requirement.
 * The group itself is soft-deleted to preserve audit history.
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

const deleteGroup = async (req: Request, res: Response) => {
  Logger.info(`Delete Group request`);

  const { id } = req.params;
  const { loggedInId, group } = res.locals;

  try {
    await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        await manager.getRepository(UserGroupMapping).delete({ groupId: id });
        group.deletedBy = loggedInId;
        await manager.getRepository(Group).save(group);
        await manager.getRepository(Group).softRemove(group);
      },
    );

    sendResponse(res, true, CODE.SUCCESS, GROUP_MSG.DELETED);
  } catch (error) {
    Logger.error(`Error while deleting group: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default deleteGroup;
