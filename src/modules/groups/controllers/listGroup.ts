/**
 * listGroup — returns paginated groups with their member counts and role names.
 *
 * Role names are joined in a second query (raw QueryBuilder + IN clause) rather
 * than an ORM relation because `Role` lives in the same shared DB schema and a
 * simple raw select avoids loading the entire Role entity for name-only display.
 *
 * UserGroupMapping rows are hard-deleted when users are removed, so there's no
 * need to filter by user.deletedOn in this list context — orphaned mappings
 * don't accumulate.
 *
 * The `roleId` filter is applied separately from the JSON filter because it's a
 * first-class parameter with its own query param slot, not a filter field.
 */
import { Request, Response } from 'express';
import { CODE, DEFAULT_PAGE, MAX_ROW } from '../../../../config/config';
import {
  GENERIC,
  GROUP as GROUP_MSG,
} from '../../../shared/constants/response.messages';
import { Group } from '../../../shared/db/entities/group.entity';
import { applySort } from '../../../shared/utility/listSort';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { GroupListSortField } from '../middleware/listGroup.validation';
import { AppDataSource } from '../../../shared/db';

const SORT_COLUMN_MAP: Record<GroupListSortField, string> = {
  name: 'group.name',
  status: 'group.status',
  createdOn: 'group.createdOn',
};

const listGroup = async (req: Request, res: Response) => {
  Logger.info(`List Groups request`);

  const {
    limit = MAX_ROW,
    page = DEFAULT_PAGE,
    filter,
    roleId,
    sort,
  } = req.query as {
    limit?: number;
    page?: number;
    filter?: string;
    roleId?: string;
    sort?: string;
  };

  const { orgData } = res.locals;
  const orgId = orgData.id;

  try {
    // UserGroupMapping records are hard-deleted when users are removed,
    // so no need to filter by user's deletedOn
    const qb = AppDataSource
      .getRepository(Group)
      .createQueryBuilder('group')
      .leftJoinAndSelect('group.userGroups', 'userGroups')
      .where('group.organisationId = :orgId', { orgId });

    if (roleId) {
      qb.andWhere('group.roleId = :roleId', { roleId });
    }

    if (filter) {
      try {
        const parsedFilter = JSON.parse(filter);
        if (parsedFilter.name) {
          qb.andWhere('group.name ILIKE :name', {
            name: `%${parsedFilter.name}%`,
          });
        }
        if (parsedFilter.description) {
          qb.andWhere('group.description ILIKE :description', {
            description: `%${parsedFilter.description}%`,
          });
        }
        if (parsedFilter.createdDateFrom) {
          qb.andWhere('group.createdOn >= :createdFrom', {
            createdFrom: parsedFilter.createdDateFrom,
          });
        }
        if (parsedFilter.createdDateTo) {
          qb.andWhere('group.createdOn <= :createdTo', {
            createdTo: parsedFilter.createdDateTo,
          });
        }
        if (
          parsedFilter.status !== undefined &&
          parsedFilter.status !== null &&
          parsedFilter.status !== ''
        ) {
          qb.andWhere('group.status = :status', {
            status: Number(parsedFilter.status),
          });
        }
      } catch (error) {
        Logger.error(`Error parsing filter: ${error}`);
      }
    }

    applySort(qb, sort, SORT_COLUMN_MAP, 'group.createdOn', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [groups, count] = await qb.getManyAndCount();

    // Attach roleName for each group
    const roleIds = [
      ...new Set(groups.map((g: any) => g.roleId).filter(Boolean)),
    ];
    const roleMap: Record<string, string> = {};
    if (roleIds.length > 0) {
      const roles = await AppDataSource
        .createQueryBuilder()
        .select(['role.id AS id', 'role.name AS name'])
        .from('role', 'role')
        .where('role.id IN (:...ids)', { ids: roleIds })
        .getRawMany();
      roles.forEach((r: any) => {
        roleMap[r.id] = r.name;
      });
    }
    const groupsWithRole = groups.map((g: any) => ({
      ...g,
      roleName: g.roleId ? roleMap[g.roleId] || null : null,
    }));

    sendResponse(res, true, CODE.SUCCESS, GROUP_MSG.LIST_FETCHED, {
      count,
      groups: groupsWithRole,
    });
  } catch (error) {
    Logger.error(`Error in listGroup: ${error}`);
    sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default listGroup;
