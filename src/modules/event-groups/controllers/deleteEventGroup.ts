/**
 * deleteEventGroup — hard-deletes mappings, soft-deletes the group.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
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

const deleteEventGroup = async (req: Request, res: Response) => {
  Logger.info(`Delete Event Group request`);

  const { id } = req.params;
  const { loggedInId, eventGroup } = res.locals;

  try {
    await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        await manager
          .getRepository(EventGroupMapping)
          .delete({ eventGroupId: id });

        eventGroup.deletedBy = loggedInId;
        await manager.getRepository(EventGroup).save(eventGroup);
        await manager.getRepository(EventGroup).softRemove(eventGroup);
      },
    );

    sendResponse(res, true, CODE.SUCCESS, EG_MSG.DELETED);
  } catch (error) {
    Logger.error(`Error deleting event group: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default deleteEventGroup;
