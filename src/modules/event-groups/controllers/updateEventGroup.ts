/**
 * updateEventGroup — replaces member list atomically alongside metadata changes.
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

interface MemberInput {
  memberId: string;
  level?: string;
  language?: string;
  sourceId?: number;
}

const updateEventGroup = async (req: Request, res: Response) => {
  Logger.info(`Update Event Group request`);

  const { id, name, description, sourceId, status, members } = req.body as {
    id: string;
    name?: string;
    description?: string;
    sourceId?: number;
    status?: number;
    members?: MemberInput[];
  };
  const { loggedInId, eventGroup, clientData } = res.locals;

  try {
    eventGroup.name = name ?? eventGroup.name;
    eventGroup.description =
      description !== undefined ? description : eventGroup.description;
    if (sourceId !== undefined) eventGroup.sourceId = sourceId;
    if (status !== undefined) eventGroup.status = status;
    eventGroup.updatedBy = loggedInId;

    let result!: EventGroup;
    await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        await manager
          .getRepository(EventGroupMapping)
          .delete({ eventGroupId: id });

        if (members && members.length > 0) {
          const mappings = members.map(m => ({
            eventGroupId: id,
            memberId: m.memberId,
            clientId: clientData.id,
            sourceId: (m.sourceId ?? eventGroup.sourceId) as number,
            language: m.language ?? 'en',
            level: m.level ?? 'PT',
            createdBy: loggedInId,
          }));
          await manager.getRepository(EventGroupMapping).insert(mappings);
        }

        result = await manager.getRepository(EventGroup).save(eventGroup);
      },
    );

    sendResponse(res, true, CODE.SUCCESS, EG_MSG.UPDATED, result);
  } catch (error) {
    Logger.error(`Error updating event group: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default updateEventGroup;
