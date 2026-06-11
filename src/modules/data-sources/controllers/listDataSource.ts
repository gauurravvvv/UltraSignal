/**
 * listDataSource — paginated, filterable, sortable list of data sources
 * for the caller's client. The type label is joined in so the FE can
 * render "AEMS / UAN" next to each row without a second query.
 *
 * Filter is a JSON-encoded query param (same convention as roles/users):
 *   { name?, description?, typeId?, status?, createdDateFrom?, createdDateTo? }
 *
 * Sort is column-whitelisted in the validation middleware; this
 * controller maps the validated field name to the actual TypeORM column
 * reference.
 */
import { Request, Response } from 'express';
import { CODE, DEFAULT_PAGE, MAX_ROW } from '../../../../config/config';
import {
  DATA_SOURCE as DS_MSG,
  GENERIC,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { DataSource } from '../../../shared/db/entities/data-source.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { applySort } from '../../../shared/utility/listSort';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { DataSourceListSortField } from '../middleware/listDataSource.validation';

const SORT_COLUMN_MAP: Record<DataSourceListSortField, string> = {
  name: 'ds.name',
  status: 'ds.status',
  createdOn: 'ds.createdOn',
};

const listDataSource = async (req: Request, res: Response) => {
  Logger.info('List Data Sources request');

  const {
    limit = MAX_ROW,
    page = DEFAULT_PAGE,
    filter,
    sort,
  } = req.query as {
    limit?: number;
    page?: number;
    filter?: string;
    sort?: string;
  };

  const { clientData } = res.locals;
  const clientId = clientData.id;

  try {
    const query = AppDataSource.getRepository(DataSource)
      .createQueryBuilder('ds')
      .leftJoinAndSelect('ds.type', 'type')
      .where('ds.clientId = :clientId', { clientId });

    if (filter) {
      try {
        const parsed = JSON.parse(filter);
        if (parsed.name) {
          query.andWhere('ds.name ILIKE :name', { name: `%${parsed.name}%` });
        }
        if (parsed.description) {
          query.andWhere('ds.description ILIKE :description', {
            description: `%${parsed.description}%`,
          });
        }
        if (parsed.typeId) {
          query.andWhere('ds."typeId" = :typeId', { typeId: parsed.typeId });
        }
        if (parsed.createdDateFrom) {
          query.andWhere('ds.createdOn >= :createdFrom', {
            createdFrom: parsed.createdDateFrom,
          });
        }
        if (parsed.createdDateTo) {
          query.andWhere('ds.createdOn <= :createdTo', {
            createdTo: parsed.createdDateTo,
          });
        }
        if (
          parsed.status !== undefined &&
          parsed.status !== null &&
          parsed.status !== ''
        ) {
          query.andWhere('ds.status = :status', {
            status: Number(parsed.status),
          });
        }
      } catch (e) {
        Logger.error(`Error parsing filter: ${getErrorMessage(e)}`);
      }
    }

    applySort(query, sort, SORT_COLUMN_MAP, 'ds.createdOn', 'DESC');

    const [rows, count] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const dataSources = rows.map((r: any) => ({
      ...r,
      typeName: r.type?.name ?? null,
      typeSourceId: r.type?.sourceId ?? null,
    }));

    sendResponse(res, true, CODE.SUCCESS, DS_MSG.LIST_FETCHED, {
      count,
      dataSources,
    });
  } catch (error) {
    Logger.error(`Error listing data sources: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default listDataSource;
