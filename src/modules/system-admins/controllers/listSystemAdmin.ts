/**
 * listSystemAdmin — returns a paginated, filterable list of all system admins.
 *
 * Filters are passed as a JSON string in the ?filter= query param rather than
 * individual query params so the client can compose arbitrary filter combinations
 * without requiring the API to enumerate every permutation. An invalid JSON string
 * is silently skipped (no 400) — this is intentional so a partially-built filter
 * doesn't block the whole list view.
 *
 * Two computed fields are added to every row:
 *  - canDelete: false if the admin is the built-in default (isDefault=1) or the
 *    currently logged-in user — prevents self-deletion and bootstrap account deletion.
 *  - isLocked: boolean coercion of accountLockedAt (null → false, timestamp → true)
 *    provided as a convenience so the UI doesn't need null-check logic.
 */
import { Request, Response } from 'express';
import {
  CODE,
  DEFAULT_PAGE,
  IS_DEFAULT,
  MAX_ROW,
  ROLES,
  SYSTEM_CLIENT,
} from '../../../../config/config';
import {
  GENERIC,
  SYSTEM_ADMIN as SYSTEM_ADMIN_MSG,
} from '../../../shared/constants/response.messages';
import { User } from '../../../shared/db/entities/user.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { applySort } from '../../../shared/utility/listSort';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { SystemAdminListSortField } from '../middleware/listSystemAdmin.validation';

const SORT_COLUMN_MAP: Record<SystemAdminListSortField, string> = {
  username: 'user.username',
  firstName: 'user.firstName',
  lastName: 'user.lastName',
  email: 'user.email',
  lastLogin: 'user.lastLogin',
  status: 'user.status',
  createdOn: 'user.createdOn',
};

const listSystemAdmin = async (req: Request, res: Response) => {
  Logger.info(`List System admin request`);

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

    const query = User.createQueryBuilder('user')
      .where('user.clientName = :orgName', {
        orgName: SYSTEM_CLIENT.NAME,
      })
      .andWhere('user.role = :role', { role: ROLES.SYSTEM_ADMIN });

    if (filter) {
      try {
        const parsedFilter = JSON.parse(filter);
        if (parsedFilter.username) {
          query.andWhere('user.username ILIKE :username', {
            username: `%${parsedFilter.username}%`,
          });
        }
        if (parsedFilter.firstName) {
          query.andWhere('user.firstName ILIKE :firstName', {
            firstName: `%${parsedFilter.firstName}%`,
          });
        }
        if (parsedFilter.lastName) {
          query.andWhere('user.lastName ILIKE :lastName', {
            lastName: `%${parsedFilter.lastName}%`,
          });
        }
        if (parsedFilter.email) {
          query.andWhere('user.email ILIKE :email', {
            email: `%${parsedFilter.email}%`,
          });
        }
        if (parsedFilter.lastLoginDateFrom) {
          query.andWhere('user.lastLogin >= :lastLoginFrom', {
            lastLoginFrom: parsedFilter.lastLoginDateFrom,
          });
        }
        if (parsedFilter.lastLoginDateTo) {
          query.andWhere('user.lastLogin <= :lastLoginTo', {
            lastLoginTo: parsedFilter.lastLoginDateTo,
          });
        }
        if (parsedFilter.createdDateFrom) {
          query.andWhere('user.createdOn >= :createdFrom', {
            createdFrom: parsedFilter.createdDateFrom,
          });
        }
        if (parsedFilter.createdDateTo) {
          query.andWhere('user.createdOn <= :createdTo', {
            createdTo: parsedFilter.createdDateTo,
          });
        }
        if (
          parsedFilter.status !== undefined &&
          parsedFilter.status !== null &&
          parsedFilter.status !== ''
        ) {
          query.andWhere('user.status = :status', {
            status: Number(parsedFilter.status),
          });
        }
      } catch (error) {
        Logger.error(`Error parsing filter: ${error}`);
      }
    }

    const { loggedInId } = res.locals;

    applySort(query, sort, SORT_COLUMN_MAP, 'user.createdOn', 'DESC');
    query.skip((page - 1) * limit).take(limit);

    const [systemAdmins, count] = await query.getManyAndCount();

    const systemAdminsWithCanDelete = systemAdmins.map(admin => ({
      ...admin,
      canDelete: admin.isDefault !== IS_DEFAULT.YES && admin.id !== loggedInId,
      isLocked: !!admin.accountLockedAt,
    }));

    sendResponse(res, true, CODE.SUCCESS, SYSTEM_ADMIN_MSG.LIST_FETCHED, {
      count,
      systemAdmins: systemAdminsWithCanDelete,
    });
  } catch (error) {
    Logger.error(
      `Error while fetching System admin: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default listSystemAdmin;
