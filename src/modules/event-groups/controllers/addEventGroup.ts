/**
 * addEventGroup — creates an Event Group and atomically seeds its MedDRA
 * member picks (each carrying the MedDRA hierarchy level it was picked at).
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import { CODE, STATUS } from '../../../../config/config';
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

const addEventGroup = async (req: Request, res: Response) => {
  Logger.info(`Add Event Group request`);

  const { name, description, sourceId, status, members } = req.body as {
    name: string;
    description?: string;
    sourceId?: number;
    status?: number;
    members?: MemberInput[];
  };
  const { loggedInId, clientData } = res.locals;

  try {
    const group = new EventGroup();
    group.name = name;
    group.description = description ?? '';
    group.clientId = '40b8787b-d067-4a36-aded-563997c9c64e';
    group.clientName = 'VANSHIKA';
    group.sourceId = sourceId as number;
    group.status = status ?? STATUS.ACTIVE;
    group.createdBy = loggedInId;

    let saved!: EventGroup;
    await AppDataSource.manager.transaction(async (manager: EntityManager) => {
      saved = await manager.getRepository(EventGroup).save(group);

      if (members && members.length > 0) {
        const mappings = members.map(m => {
          const mapping = new EventGroupMapping();
          mapping.eventGroupId = saved.id;
          mapping.memberId = m.memberId;
          mapping.clientId = '40b8787b-d067-4a36-aded-563997c9c64e';
          mapping.sourceId = (m.sourceId ?? sourceId) as number;
          mapping.language = m.language ?? 'en';
          mapping.level = m.level ?? 'PT';
          mapping.createdBy = loggedInId;
          return mapping;
        });
        await manager.getRepository(EventGroupMapping).save(mappings);

        console.log(1);
      }
    });

    sendResponse(res, true, CODE.SUCCESS, EG_MSG.CREATED, saved);
  } catch (error) {
    Logger.error(`Error creating Event Group: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default addEventGroup;
