/**
 * listProductGroup — paginated, filterable, sortable list of product
 * groups with their parent scope joined inline. Mirrors the
 * threshold-profile list controller's shape so the FE can reuse the
 * same paginator / sort / filter ergonomics.
 *
 * Member rows are NOT joined by default — the list screen only needs
 * counts per group. When `?includeMembers=true` the controller fans
 * out a second batch query keyed by IN (...productGroupId), grouping
 * members in JS so pagination stays correct.
 *
 * Soft-deleted rows are filtered out at the SQL layer (`deleted =
 * false`) — they never appear in user-facing lists.
 *
 * Filter keys (all optional, only present keys filter):
 *   - name              → ILIKE %term% on name
 *   - code              → ILIKE %term% on code
 *   - description       → ILIKE %term% on description
 *   - scopeId           → exact match (numeric)
 *   - status            → 0|1 maps to is_enabled boolean
 *   - createdDateFrom   → pg.created_at >= :from
 *   - createdDateTo     → pg.created_at <= :to
 *
 * Soft-deleted rows (`deleted_on IS NOT NULL`) are hidden at the SQL
 * layer — they never appear in user-facing lists.
 *
 * `canEdit` / `canDelete` are computed per row:
 *   - `scope.code === 'system'`        → both false (platform-owned, read-only)
 *   - `clientId !== caller.clientCode` → both false (cross-tenant)
 *   - otherwise                        → both true
 *
 * Malformed JSON in `filter` is logged + ignored. Mirrors threshold-
 * profile convention so a bad FE state doesn't break the page.
 */
import { In } from 'typeorm';
import { Request, Response } from 'express';
import { CODE, DEFAULT_PAGE, MAX_ROW } from '../../../../config/config';
import {
  GENERIC,
  PRODUCT_GROUP as PG_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ProductGroup } from '../../../shared/db/entities/product-group.entity';
import { ProductGroupMember } from '../../../shared/db/entities/product-group-member.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { applySort } from '../../../shared/utility/listSort';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { ProductGroupListSortField } from '../middleware/listProductGroup.validation';

/* JS property names per TypeORM mapping — the QB rewrites them to
 * column names at SQL-gen time. */
const SORT_COLUMN_MAP: Record<ProductGroupListSortField, string> = {
  name: 'pg.name',
  code: 'pg.code',
  scopeId: 'pg.scopeId',
  createdAt: 'pg.createdAt',
};

const listProductGroup = async (req: Request, res: Response) => {
  Logger.info('List Product Groups request');

  const {
    limit = MAX_ROW,
    page = DEFAULT_PAGE,
    filter,
    sort,
    includeMembers,
  } = req.query as {
    limit?: number;
    page?: number;
    filter?: string;
    sort?: string;
    includeMembers?: boolean;
  };

  /* clientData is stamped onto res.locals by AuthMiddleware. The 4-
   * char clientCode is what we wrote into `client_id` on create, so
   * the same value gates canEdit / canDelete here. */
  const callerClientCode: string | null =
    res.locals.clientData?.clientCode ?? null;

  try {
    const query = AppDataSource.getRepository(ProductGroup)
      .createQueryBuilder('pg')
      .leftJoinAndSelect('pg.scope', 'scope')
      .where('pg.deleted_on IS NULL');

    if (filter) {
      try {
        const parsed = JSON.parse(filter);
        if (parsed.name) {
          query.andWhere('pg.name ILIKE :name', {
            name: `%${parsed.name}%`,
          });
        }
        if (parsed.code) {
          query.andWhere('pg.code ILIKE :code', {
            code: `%${parsed.code}%`,
          });
        }
        if (parsed.description) {
          query.andWhere('pg.description ILIKE :description', {
            description: `%${parsed.description}%`,
          });
        }
        if (
          parsed.scopeId !== undefined &&
          parsed.scopeId !== null &&
          parsed.scopeId !== ''
        ) {
          query.andWhere('pg.scope_id = :scopeId', {
            scopeId: Number(parsed.scopeId),
          });
        }
        if (
          parsed.status !== undefined &&
          parsed.status !== null &&
          parsed.status !== ''
        ) {
          query.andWhere('pg.is_enabled = :isEnabled', {
            isEnabled: Number(parsed.status) === 1,
          });
        }
        if (parsed.createdDateFrom) {
          query.andWhere('pg.created_at >= :createdFrom', {
            createdFrom: parsed.createdDateFrom,
          });
        }
        if (parsed.createdDateTo) {
          query.andWhere('pg.created_at <= :createdTo', {
            createdTo: parsed.createdDateTo,
          });
        }
      } catch (e) {
        Logger.error(`Error parsing filter: ${getErrorMessage(e)}`);
      }
    }

    applySort(query, sort, SORT_COLUMN_MAP, 'pg.createdAt', 'DESC');

    const [rows, count] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    /* Batch-load member counts (or full members when requested) in a
     * single round trip keyed by IN(...). Cheaper than letting TypeORM
     * eager-join — that would multiply parent rows and break the
     * paginator's `count`. */
    const groupIds = rows.map(r => r.productGroupId);
    const membersByGroup = new Map<number, ProductGroupMember[]>();
    const countsByGroup = new Map<number, number>();

    if (groupIds.length > 0) {
      if (includeMembers) {
        const ms = await AppDataSource.getRepository(ProductGroupMember).find({
          where: { productGroupId: In(groupIds) },
          order: { productGroupMemberId: 'ASC' },
        });
        for (const m of ms) {
          if (!membersByGroup.has(m.productGroupId)) {
            membersByGroup.set(m.productGroupId, []);
          }
          membersByGroup.get(m.productGroupId)!.push(m);
          countsByGroup.set(
            m.productGroupId,
            (countsByGroup.get(m.productGroupId) ?? 0) + 1,
          );
        }
      } else {
        const counts = await AppDataSource.getRepository(ProductGroupMember)
          .createQueryBuilder('m')
          .select('m.product_group_id', 'productGroupId')
          .addSelect('COUNT(*)', 'count')
          .where('m.product_group_id IN (:...ids)', { ids: groupIds })
          .andWhere('m.deleted_on IS NULL')
          .groupBy('m.product_group_id')
          .getRawMany<{ productGroupId: number; count: string }>();
        for (const c of counts) {
          countsByGroup.set(Number(c.productGroupId), Number(c.count));
        }
      }
    }

    const productGroups = rows.map(pg => {
      /* Two-rule mutability check, mirrors threshold profiles:
       *   - system-scope rows are platform-defined and read-only
       *   - cross-tenant rows belong to another client; the caller
       *     can list them (per scope rules) but can't mutate them */
      const isSystem = pg.scope?.code === 'system';
      const ownsRow =
        !!callerClientCode && pg.clientId === callerClientCode;
      const isMutable = !isSystem && ownsRow;
      return {
        ...pg,
        memberCount: countsByGroup.get(pg.productGroupId) ?? 0,
        ...(includeMembers
          ? { members: membersByGroup.get(pg.productGroupId) ?? [] }
          : {}),
        canEdit: isMutable,
        canDelete: isMutable,
      };
    });

    sendResponse(res, true, CODE.SUCCESS, PG_MSG.LIST_FETCHED, {
      count,
      productGroups,
    });
  } catch (error) {
    Logger.error(
      `Error while listing product groups: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default listProductGroup;
