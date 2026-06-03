/**
 * deleteGroup — cascades hard-deletes to member mappings and access records, then
 * soft-deletes the group itself.
 *
 * UserGroupMapping and DatasourceAccess rows are hard-deleted (no soft-delete needed)
 * because group membership and DB access are operational state with no recovery
 * requirement. The group itself is soft-deleted to preserve audit history.
 *
 * The announcement check runs outside the transaction (read-only) to return a
 * meaningful error before starting any writes. Announcements targeting this group
 * would become orphaned if the group were deleted, causing display errors in the UI.
 *
 * Middleware pre-validates that the group has no active database access assignments,
 * so the DatasourceAccess.delete inside the transaction is expected to be a no-op —
 * it's there as a safety net.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  GROUP as GROUP_MSG,
} from '../../../shared/constants/response.messages';
import { Announcement } from '../../../shared/db/entities/announcement.entity';
import { DatasourceAccess } from '../../../shared/db/entities/datasource_access.entity';
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
    // Block deletion if any announcements target this group (read-only check, outside tx)
    const linkedCount = await AppDataSource
      .getRepository(Announcement)
      .count({ where: { targetGroupId: id } });
    if (linkedCount > 0) {
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        `Cannot delete group — ${linkedCount} announcement(s) target it. ` +
          `Delete or reassign those announcements first.`,
      );
    }

    await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        await manager.getRepository(UserGroupMapping).delete({ groupId: id });
        await manager.getRepository(DatasourceAccess).delete({ groupId: id });
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
