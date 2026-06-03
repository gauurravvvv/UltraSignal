/**
 * listRole — returns a paginated list of roles for an org with optional filters.
 *
 * The filter parameter is a JSON string (not individual query params) to keep the
 * URL clean and allow arbitrary filter combinations without enumerating every
 * possible field in the route signature. Malformed JSON is logged and silently
 * ignored so a bad filter string doesn't crash the list endpoint.
 *
 * `createdOn ASC` ordering ensures newly-added roles appear at the end of the list
 * rather than the beginning, matching the "append" UX expectation.
 */
import { Request, Response } from 'express';
import { CODE, DEFAULT_PAGE, MAX_ROW } from '../../../../config/config';
import {
  GENERIC,
  ROLE as ROLE_MSG,
} from '../../../shared/constants/response.messages';
import { Role } from '../../../shared/db/entities/role.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { AppDataSource } from '../../../shared/db';

const listRole = async (req: Request, res: Response) => {
  Logger.info('List Roles request');

  const { orgData } = res.locals;
  const orgId = orgData.id;
  const {
    limit = MAX_ROW,
    page = DEFAULT_PAGE,
    filter,
  } = req.query as {
    limit?: number;
    page?: number;
    filter?: string;
  };

  try {
    const query = AppDataSource
      .getRepository(Role)
      .createQueryBuilder('role')
      .where('role.organisationId = :orgId', { orgId });

    if (filter) {
      try {
        const parsedFilter = JSON.parse(filter);
        if (parsedFilter.name) {
          query.andWhere('role.name ILIKE :name', {
            name: `%${parsedFilter.name}%`,
          });
        }
        if (parsedFilter.description) {
          query.andWhere('role.description ILIKE :description', {
            description: `%${parsedFilter.description}%`,
          });
        }
        if (
          parsedFilter.status !== undefined &&
          parsedFilter.status !== null &&
          parsedFilter.status !== ''
        ) {
          query.andWhere('role.status = :status', {
            status: Number(parsedFilter.status),
          });
        }
        if (parsedFilter.createdDateFrom) {
          query.andWhere('role.createdOn >= :createdFrom', {
            createdFrom: parsedFilter.createdDateFrom,
          });
        }
        if (parsedFilter.createdDateTo) {
          query.andWhere('role.createdOn <= :createdTo', {
            createdTo: parsedFilter.createdDateTo,
          });
        }
      } catch (e) {
        Logger.error(`Error parsing filter: ${e.message}`);
      }
    }

    const [roles, count] = await query
      .orderBy('role.createdOn', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    sendResponse(res, true, CODE.SUCCESS, ROLE_MSG.LIST_FETCHED, {
      count,
      roles,
    });
  } catch (error) {
    Logger.error(`Error while listing roles: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default listRole;
