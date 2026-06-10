/**
 * listUsers — paginates client users with inline group counts and names.
 *
 * Group membership is loaded in a second query rather than via a TypeORM
 * relation join because UserGroupMapping is a hard-deleted junction table —
 * rows are removed on group unassignment, so there are no soft-delete
 * complications. The second query batches all user IDs in a single IN clause
 * to avoid N+1 round-trips.
 *
 * `canEdit`, `canDelete`, and `isLocked` are added here (same as getUser)
 * so the list view can render action controls without a per-row detail
 * fetch. A row is non-mutable (canEdit / canDelete both false) when:
 *   - `isDefault === 1` — system-seeded "master" admin, protected by the
 *     server-side guards in updateUser/deleteUser validation, OR
 *   - the row IS the caller — users shouldn't edit or delete themselves
 *     from the user management screen (profile edits live elsewhere).
 *
 * The `filter` query param is a JSON-serialised object; malformed JSON is
 * caught and silently ignored so an invalid filter degrades to an unfiltered
 * list rather than an error response.
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
  USER as USER_MSG,
} from '../../../shared/constants/response.messages';
import { UserGroupMapping } from '../../../shared/db/entities/user-group-mapping.entity';
import { User } from '../../../shared/db/entities/user.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { applySort } from '../../../shared/utility/listSort';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { UserListSortField } from '../middleware/listUser.validation';
import { AppDataSource } from '../../../shared/db';

const SORT_COLUMN_MAP: Record<UserListSortField, string> = {
  username: 'user.username',
  firstName: 'user.firstName',
  lastName: 'user.lastName',
  email: 'user.email',
  lastLogin: 'user.lastLogin',
  status: 'user.status',
  createdOn: 'user.createdOn',
};

const listUsers = async (req: Request, res: Response) => {
  Logger.info(`List Users request`);

  try {
    const {
      limit = MAX_ROW,
      page = DEFAULT_PAGE,
      filter,
      groupId,
      sort,
    } = req.query as {
      limit?: number;
      page?: number;
      filter?: string;
      groupId?: string;
      sort?: string;
    };

    const { clientData, loggedInId } = res.locals;
    const clientId = clientData.id;

    const query = AppDataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .where('user.clientId = :clientId', { clientId });

    if (groupId) {
      query.innerJoin('user.userGroups', 'ugm', 'ugm.groupId = :groupId', {
        groupId,
      });
    }

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
        Logger.error(`Error while parsing filter: ${getErrorMessage(error)}`);
      }
    }

    applySort(query, sort, SORT_COLUMN_MAP, 'user.createdOn', 'DESC');
    query.skip((page - 1) * limit).take(limit);

    const [users, count] = await query.getManyAndCount();

    const userIds = users.map((u: any) => u.id);
    const groupCountMap: Record<string, number> = {};
    const groupNameMap: Record<string, string[]> = {};
    if (userIds.length > 0) {
      const mappings = await AppDataSource
        .getRepository(UserGroupMapping)
        .createQueryBuilder('m')
        .innerJoinAndSelect('m.group', 'g')
        .where('m.userId IN (:...ids)', { ids: userIds })
        .getMany();

      for (const m of mappings) {
        if (!groupCountMap[m.userId]) {
          groupCountMap[m.userId] = 0;
          groupNameMap[m.userId] = [];
        }
        groupCountMap[m.userId]++;
        groupNameMap[m.userId].push((m as any).group.name);
      }
    }

    const usersWithMeta = users.map((user: any) => {
      const isMutable =
        user.isDefault !== IS_DEFAULT.YES && user.id !== loggedInId;
      return {
        ...user,
        canEdit: isMutable,
        canDelete: isMutable,
        isLocked: !!user.accountLockedAt,
        groupCount: groupCountMap[user.id] || 0,
        groupNames: groupNameMap[user.id] || [],
      };
    });

    sendResponse(res, true, CODE.SUCCESS, USER_MSG.LIST_FETCHED, {
      count,
      users: usersWithMeta,
    });
  } catch (error) {
    Logger.error(`Error while fetching users: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default listUsers;
