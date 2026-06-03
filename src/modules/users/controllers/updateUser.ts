/**
 * updateUser — patches user profile fields and replaces group memberships atomically.
 *
 * Group memberships use full-replace semantics (delete-all + re-insert) inside
 * the same transaction because the UI always sends the complete desired member
 * set. A diff-and-patch approach would require the server to know the prior
 * state, adding a read round-trip for no functional benefit.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  USER as USER_MSG,
} from '../../../shared/constants/response.messages';
import { UserGroupMapping } from '../../../shared/db/entities/user-group-mapping.entity';
import { User } from '../../../shared/db/entities/user.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { AppDataSource } from '../../../shared/db';

const updateUser = async (req: Request, res: Response) => {
  Logger.info(`Update User request`);

  const { email, username, firstName, lastName, status, groupIds } = req.body;
  const { loggedInId, orgUser } = res.locals;

  try {
    orgUser.firstName = firstName ? firstName : orgUser.firstName;
    orgUser.lastName = lastName ? lastName : orgUser.lastName;
    orgUser.username = username ? username : orgUser.username;
    orgUser.email = email ? email : orgUser.email;
    orgUser.status = status;
    orgUser.updatedBy = loggedInId;

    let result!: User;

    await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        result = await manager.getRepository(User).save(orgUser);

        if (groupIds && groupIds.length > 0) {
          await manager
            .getRepository(UserGroupMapping)
            .delete({ userId: orgUser.id });
          const mappings = groupIds.map((gId: string) => {
            const mapping = new UserGroupMapping();
            mapping.userId = orgUser.id;
            mapping.groupId = gId;
            return mapping;
          });
          await manager.getRepository(UserGroupMapping).save(mappings);
        }
      },
    );

    sendResponse(res, true, CODE.SUCCESS, USER_MSG.UPDATED, result);
  } catch (error) {
    Logger.error(`Error while updating user: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default updateUser;
