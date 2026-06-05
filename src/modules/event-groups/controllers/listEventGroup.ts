/**
 * listEventGroup — paginated list of event groups in the caller's tenant
 * with member counts attached via a single grouped sub-query.
 */
import { Request, Response } from 'express';
import { CODE, DEFAULT_PAGE, MAX_ROW } from '../../../../config/config';
import {
  EVENT_GROUP as EG_MSG,
  GENERIC,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { EventGroup } from '../../../shared/db/entities/eventGroup.entity';
import { EventGroupMapping } from '../../../shared/db/entities/eventGroupMapping.entity';
import { applySort } from '../../../shared/utility/listSort';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { EventGroupListSortField } from '../middleware/listEventGroup.validation';

const SORT_COLUMN_MAP: Record<EventGroupListSortField, string> = {
  name: 'eg.name',
  status: 'eg.status',
  createdOn: 'eg.createdOn',
};

const listEventGroup = async (req: Request, res: Response) => {
  Logger.info(`List Event Groups request`);

  const {
    limit = MAX_ROW,
    page = DEFAULT_PAGE,
    filter,
    sourceId,
    sort,
  } = req.query as {
    limit?: number;
    page?: number;
    filter?: string;
    sourceId?: string;
    sort?: string;
  };

  const { clientData } = res.locals;
  const clientId = clientData.id;

  try {
    const qb = AppDataSource.getRepository(EventGroup)
      .createQueryBuilder('eg')
      .where('eg.clientId = :clientId', { clientId });

    if (sourceId !== undefined && sourceId !== '') {
      qb.andWhere('eg.sourceId = :sourceId', { sourceId: Number(sourceId) });
    }

    if (filter) {
      try {
        const parsed = JSON.parse(filter);
        if (parsed.name) {
          qb.andWhere('eg.name ILIKE :name', { name: `%${parsed.name}%` });
        }
        if (parsed.description) {
          qb.andWhere('eg.description ILIKE :description', {
            description: `%${parsed.description}%`,
          });
        }
        if (parsed.createdDateFrom) {
          qb.andWhere('eg.createdOn >= :from', {
            from: parsed.createdDateFrom,
          });
        }
        if (parsed.createdDateTo) {
          qb.andWhere('eg.createdOn <= :to', { to: parsed.createdDateTo });
        }
        if (
          parsed.status !== undefined &&
          parsed.status !== null &&
          parsed.status !== ''
        ) {
          qb.andWhere('eg.status = :status', { status: Number(parsed.status) });
        }
      } catch (err) {
        Logger.error(`listEventGroup: bad filter JSON — ${err}`);
      }
    }

    applySort(qb, sort, SORT_COLUMN_MAP, 'eg.createdOn', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [groups, count] = await qb.getManyAndCount();

    const groupIds = groups.map((g: any) => g.id);
    const countMap: Record<string, number> = {};
    if (groupIds.length > 0) {
      const rows = await AppDataSource.getRepository(EventGroupMapping)
        .createQueryBuilder('m')
        .select('m.eventGroupId', 'eventGroupId')
        .addSelect('COUNT(*)', 'cnt')
        .where('m.eventGroupId IN (:...ids)', { ids: groupIds })
        .groupBy('m.eventGroupId')
        .getRawMany();
      for (const r of rows) {
        countMap[r.eventGroupId] = Number(r.cnt);
      }
    }
    const enriched = groups.map((g: any) => ({
      ...g,
      memberCount: countMap[g.id] || 0,
    }));

    sendResponse(res, true, CODE.SUCCESS, EG_MSG.LIST_FETCHED, {
      count,
      eventGroups: enriched,
    });
  } catch (error) {
    Logger.error(`Error in listEventGroup: ${error}`);
    sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default listEventGroup;
