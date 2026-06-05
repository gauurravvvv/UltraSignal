/**
 * listProductGroup — paginated list of product groups in the caller's client,
 * with member count attached.
 *
 * Member count is computed via a single grouped sub-query rather than loading
 * the full mappings relation per row — keeps the list endpoint cheap when a
 * tenant has many groups with many members each.
 */
import { Request, Response } from 'express';
import { CODE, DEFAULT_PAGE, MAX_ROW } from '../../../../config/config';
import {
  GENERIC,
  PRODUCT_GROUP as PG_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ProductGroup } from '../../../shared/db/entities/productGroup.entity';
import { ProductGroupMapping } from '../../../shared/db/entities/productGroupMapping.entity';
import { applySort } from '../../../shared/utility/listSort';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { ProductGroupListSortField } from '../middleware/listProductGroup.validation';

const SORT_COLUMN_MAP: Record<ProductGroupListSortField, string> = {
  name: 'pg.name',
  status: 'pg.status',
  createdOn: 'pg.createdOn',
};

const listProductGroup = async (req: Request, res: Response) => {
  Logger.info(`List Product Groups request`);

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
    const qb = AppDataSource.getRepository(ProductGroup)
      .createQueryBuilder('pg')
      .where('pg.clientId = :clientId', { clientId });

    if (sourceId !== undefined && sourceId !== '') {
      qb.andWhere('pg.sourceId = :sourceId', { sourceId: Number(sourceId) });
    }

    if (filter) {
      try {
        const parsed = JSON.parse(filter);
        if (parsed.name) {
          qb.andWhere('pg.name ILIKE :name', { name: `%${parsed.name}%` });
        }
        if (parsed.description) {
          qb.andWhere('pg.description ILIKE :description', {
            description: `%${parsed.description}%`,
          });
        }
        if (parsed.createdDateFrom) {
          qb.andWhere('pg.createdOn >= :from', {
            from: parsed.createdDateFrom,
          });
        }
        if (parsed.createdDateTo) {
          qb.andWhere('pg.createdOn <= :to', { to: parsed.createdDateTo });
        }
        if (
          parsed.status !== undefined &&
          parsed.status !== null &&
          parsed.status !== ''
        ) {
          qb.andWhere('pg.status = :status', { status: Number(parsed.status) });
        }
      } catch (err) {
        Logger.error(`listProductGroup: bad filter JSON — ${err}`);
      }
    }

    applySort(qb, sort, SORT_COLUMN_MAP, 'pg.createdOn', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [groups, count] = await qb.getManyAndCount();

    // Attach member counts (single grouped query, not N+1)
    const groupIds = groups.map((g: any) => g.id);
    const countMap: Record<string, number> = {};
    if (groupIds.length > 0) {
      const rows = await AppDataSource.getRepository(ProductGroupMapping)
        .createQueryBuilder('m')
        .select('m.productGroupId', 'productGroupId')
        .addSelect('COUNT(*)', 'cnt')
        .where('m.productGroupId IN (:...ids)', { ids: groupIds })
        .groupBy('m.productGroupId')
        .getRawMany();
      for (const r of rows) {
        countMap[r.productGroupId] = Number(r.cnt);
      }
    }
    const enriched = groups.map((g: any) => ({
      ...g,
      memberCount: countMap[g.id] || 0,
    }));

    sendResponse(res, true, CODE.SUCCESS, PG_MSG.LIST_FETCHED, {
      count,
      productGroups: enriched,
    });
  } catch (error) {
    Logger.error(`Error in listProductGroup: ${error}`);
    sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default listProductGroup;
