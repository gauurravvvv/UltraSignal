/**
 * addGroup — creates a group and atomically seeds its initial member list.
 *
 * The Group save and UserGroupMapping inserts run in a single transaction so the
 * group is never visible without its intended members. A failure mid-insert would
 * leave the group in a partially-populated state that's hard to detect or recover.
 *
 * UserGroupMapping uses a separate junction table (rather than a Group.users array)
 * because group membership needs to be queryable in both directions — from group
 * and from user — without loading the entire collection every time.
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

const addGroup = async (req: Request, res: Response) => {
  Logger.info(`Add Group request`);

  const { name, description, status, roleId, users } = req.body;
  const { loggedInId, clientData } = res.locals;
  try {
    // Create environment in the specific database
    const orgGroup = new Group();
    orgGroup.name = name;
    orgGroup.description = description;
    orgGroup.clientId = clientData.id;
    orgGroup.clientName = clientData.name;
    orgGroup.roleId = roleId;
    orgGroup.status = status ?? 1;
    orgGroup.createdBy = loggedInId;

    let savedGroup!: Group;
    await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        savedGroup = await manager.getRepository(Group).save(orgGroup);

        if (users && users.length > 0) {
          const mappings = users.map((uId: string) => {
            const m = new UserGroupMapping();
            m.userId = uId;
            m.groupId = savedGroup.id;
            return m;
          });
          await manager.getRepository(UserGroupMapping).save(mappings);
        }
      },
    );

    sendResponse(res, true, CODE.SUCCESS, GROUP_MSG.CREATED, savedGroup);
  } catch (error) {
    Logger.error(`Error while creating Group: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default addGroup;
