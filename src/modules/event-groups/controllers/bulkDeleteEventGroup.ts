/**
 * bulkDeleteEventGroup — hard-deletes mappings for all selected groups,
 * then soft-deletes each group.
 */
import { Request, Response } from 'express';
import { EntityManager, In } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  EVENT_GROUP as EG_MSG,
  GENERIC,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { EventGroup } from '../../../shared/db/entities/eventGroup.entity';
import { EventGroupMapping } from '../../../shared/db/entities/eventGroupMapping.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const bulkDeleteEventGroup = async (req: Request, res: Response) => {
  Logger.info(`Bulk delete Event Group request`);

  const { loggedInId, eventGroups } = res.locals;

  try {
    const ids: string[] = eventGroups.map((g: EventGroup) => g.id);

    await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        await manager
          .getRepository(EventGroupMapping)
          .delete({ eventGroupId: In(ids) });

        for (const group of eventGroups) {
          group.deletedBy = loggedInId;
          await manager.getRepository(EventGroup).save(group);
          await manager.getRepository(EventGroup).softRemove(group);
        }
      },
    );

    sendResponse(res, true, CODE.SUCCESS, EG_MSG.BULK_DELETED, {
      deletedCount: ids.length,
      deletedIds: ids,
    });
  } catch (error) {
    Logger.error(`Error bulk deleting event groups: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default bulkDeleteEventGroup;
