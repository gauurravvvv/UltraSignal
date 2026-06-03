/**
 * listClient — returns paginated, filterable, sortable list of tenant
 * clients.
 *
 * Only non-default clients are listed (isDefault=0) — the root "super"
 * client is intentionally excluded since system admins should never see or
 * manage it through this endpoint.
 *
 * Filters are JSON-encoded in the ?filter= query param (same pattern as system
 * admin list). Invalid JSON is silently skipped to avoid blocking the list view.
 *
 * Sort is column-whitelisted in the validation middleware; this controller maps
 * the validated client-facing field name to the actual TypeORM column reference.
 * When no sort params are supplied we preserve the legacy default of
 * `createdOn DESC` so existing consumers see no behavioural change.
 */
import { Request, Response } from 'express';
import {
  CODE,
  DEFAULT_PAGE,
  IS_DEFAULT,
  MAX_ROW,
} from '../../../../config/config';
import {
  GENERIC,
  CLIENT as CLIENT_MSG,
} from '../../../shared/constants/response.messages';
import { Client } from '../../../shared/db/entities/client.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { applySort } from '../../../shared/utility/listSort';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { ClientListSortField } from '../middleware/listClient.validation';

// Client-facing sort field → TypeORM column reference.
// Kept in this file (not the entity) because it's a UI contract concern.
const SORT_COLUMN_MAP: Record<ClientListSortField, string> = {
  name: 'client.name',
  status: 'client.status',
  createdOn: 'client.createdOn',
};

const listClient = async (req: Request, res: Response) => {
  Logger.info(`List Clients request`);

  try {
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

    const query = Client.createQueryBuilder('client')
      .leftJoinAndSelect('client.config', 'config', 'config.deletedOn IS NULL')
      .where('client.isDefault = :isDefault', { isDefault: IS_DEFAULT.NO });

    if (filter) {
      try {
        const parsedFilter = JSON.parse(filter);
        if (parsedFilter.name) {
          query.andWhere('client.name ILIKE :name', {
            name: `%${parsedFilter.name}%`,
          });
        }
        if (parsedFilter.description) {
          query.andWhere('client.description ILIKE :description', {
            description: `%${parsedFilter.description}%`,
          });
        }
        if (parsedFilter.createdDateFrom) {
          query.andWhere('client.createdOn >= :createdFrom', {
            createdFrom: parsedFilter.createdDateFrom,
          });
        }
        if (parsedFilter.createdDateTo) {
          query.andWhere('client.createdOn <= :createdTo', {
            createdTo: parsedFilter.createdDateTo,
          });
        }
        if (
          parsedFilter.status !== undefined &&
          parsedFilter.status !== null &&
          parsedFilter.status !== ''
        ) {
          query.andWhere('client.status = :status', {
            status: Number(parsedFilter.status),
          });
        }
      } catch (error) {
        Logger.error(`Error parsing filter: ${error}`);
      }
    }

    applySort(query, sort, SORT_COLUMN_MAP, 'client.createdOn', 'DESC');

    const [clients, count] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    sendResponse(res, true, CODE.SUCCESS, CLIENT_MSG.LIST_FETCHED, {
      count,
      clients,
    });
  } catch (error) {
    Logger.error(
      `Error while listing Clients: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default listClient;
