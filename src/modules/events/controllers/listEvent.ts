/**
 * listEvent — paginated MedDRA browser. Supports filtering by hierarchy
 * level (SOC/HLGT/HLT/PT/LLT/SMQ) and free-text search across all term
 * names. Used to populate the Event Group selector UI.
 */
import { Request, Response } from 'express';
import { CODE, DEFAULT_PAGE, MAX_ROW } from '../../../../config/config';
import {
  GENERIC,
  MEDDRA as MEDDRA_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { MeddraBrowser } from '../../../shared/db/entities/meddra.entity';
import { applySort } from '../../../shared/utility/listSort';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { EventListSortField } from '../middleware/listEvent.validation';

const SORT_COLUMN_MAP: Record<EventListSortField, string> = {
  socName: 'm.soc_name',
  hlgtName: 'm.hlgt_name',
  hltName: 'm.hlt_name',
  ptName: 'm.pt_name',
  lltName: 'm.llt_name',
};

const listEvent = async (req: Request, res: Response) => {
  Logger.info(`List MedDRA Events request`);

  const {
    limit = MAX_ROW,
    page = DEFAULT_PAGE,
    search,
    level,
    language,
    sort,
  } = req.query as {
    limit?: number;
    page?: number;
    search?: string;
    level?: string;
    language?: string;
    sort?: string;
  };

  try {
    const qb =
      AppDataSource.getRepository(MeddraBrowser).createQueryBuilder('m');

    if (language) {
      qb.where('m.language = :lang', { lang: language });
    } else {
      qb.where('1 = 1');
    }

    if (level) {
      // Filter rows that have a non-null code at the requested level
      const col = {
        SOC: 'm.soc_code',
        HLGT: 'm.hlgt_code',
        HLT: 'm.hlt_code',
        PT: 'm.pt_code',
        LLT: 'm.llt_code',
        SMQ: 'm.smq_code',
      }[level.toUpperCase()] as string | undefined;

      if (col) {
        qb.andWhere(`${col} IS NOT NULL`);
      }
    }

    if (search) {
      qb.andWhere(
        `(m.socName ILIKE :q OR m.hlgt_name ILIKE :q OR m.hlt_name ILIKE :q OR m.pt_name ILIKE :q OR m.llt_name ILIKE :q OR m.smq_name ILIKE :q)`,
        { q: `%${search}%` },
      );
    }

    applySort(qb, sort, SORT_COLUMN_MAP, 'm.pt_name', 'ASC');
    qb.skip((page - 1) * limit).take(limit);

    const [events, count] = await qb.getManyAndCount();

    sendResponse(res, true, CODE.SUCCESS, MEDDRA_MSG.LIST_FETCHED, {
      count,
      events,
    });
  } catch (error) {
    Logger.error(`Error in listEvent: ${error}`);
    sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default listEvent;
