/**
 * listThresholdProfile — paginated, filterable, sortable list of
 * threshold profiles with their conditions (and parent scope) joined
 * inline.
 *
 * Same shape as `listDataSource` — JSON-encoded `filter` query param,
 * `<field>:asc|desc` sort, page/limit pagination. The `count` in the
 * response is the TOTAL filtered row count (used by the FE paginator),
 * not the page size.
 *
 * `canEdit` / `canDelete` are per-row computed flags. Rule:
 * `scope.code !== 'system'` is mutable; system rows are read-only.
 *
 * Sort field whitelist enforced by the validator. The map below
 * translates the validated FE field name into the actual TypeORM
 * column reference.
 *
 * Filter keys (all optional, only present keys filter):
 *   - name              → ILIKE %term% on display_name
 *   - code              → ILIKE %term% on code (Postgres ILIKE is
 *                          case-insensitive natively)
 *   - description       → ILIKE %term% on description
 *   - scopeId           → exact match (numeric)
 *   - status            → 0|1 maps to is_enabled boolean
 *   - createdDateFrom   → p.createdAt >= :from
 *   - createdDateTo     → p.createdAt <= :to
 *
 * Malformed JSON in `filter` is logged and silently ignored — the
 * list still returns, just unfiltered. Mirrors the data-source
 * convention so the FE doesn't break on a bad client-side state.
 */
import { In } from 'typeorm';
import { Request, Response } from 'express';
import { CODE, DEFAULT_PAGE, MAX_ROW } from '../../../../config/config';
import {
  GENERIC,
  THRESHOLD_PROFILE as TP_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ThresholdCondition } from '../../../shared/db/entities/threshold-condition.entity';
import { ThresholdProfile } from '../../../shared/db/entities/threshold-profile.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { applySort } from '../../../shared/utility/listSort';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { ThresholdProfileListSortField } from '../middleware/listThresholdProfile.validation';

// QueryBuilder references use the JS property name (TypeORM maps it
// to the DB column at SQL-gen time). The entity's `createdOn` field
// is backed by the `created_at` DB column; we always quote the JS
// name here.
const SORT_COLUMN_MAP: Record<ThresholdProfileListSortField, string> = {
  displayName: 'p.displayName',
  code: 'p.code',
  isEnabled: 'p.isEnabled',
  createdOn: 'p.createdOn',
};

const listThresholdProfile = async (req: Request, res: Response) => {
  Logger.info('List Threshold Profiles request');

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

  try {
    // We deliberately do NOT join `conditions` here. Mixing
    // `leftJoinAndSelect('p.conditions')` with `skip`/`take` makes
    // TypeORM emit a 2-step query where the first step samples the
    // joined rows (one per condition), producing duplicate IDs in the
    // IN clause and a wrong `count`. We paginate over the parent table
    // only, then fetch conditions in a second batch query below.
    const query = AppDataSource.getRepository(ThresholdProfile)
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.scope', 'scope');

    if (filter) {
      try {
        const parsed = JSON.parse(filter);
        if (parsed.name) {
          query.andWhere('p.display_name ILIKE :name', {
            name: `%${parsed.name}%`,
          });
        }
        if (parsed.code) {
          query.andWhere('p.code ILIKE :code', {
            code: `%${parsed.code}%`,
          });
        }
        if (parsed.description) {
          query.andWhere('p.description ILIKE :description', {
            description: `%${parsed.description}%`,
          });
        }
        if (
          parsed.scopeId !== undefined &&
          parsed.scopeId !== null &&
          parsed.scopeId !== ''
        ) {
          query.andWhere('p.scope_id = :scopeId', {
            scopeId: Number(parsed.scopeId),
          });
        }
        if (
          parsed.status !== undefined &&
          parsed.status !== null &&
          parsed.status !== ''
        ) {
          query.andWhere('p.is_enabled = :isEnabled', {
            isEnabled: Number(parsed.status) === 1,
          });
        }
        if (parsed.createdDateFrom) {
          query.andWhere('p.created_at >= :createdFrom', {
            createdFrom: parsed.createdDateFrom,
          });
        }
        if (parsed.createdDateTo) {
          query.andWhere('p.created_at <= :createdTo', {
            createdTo: parsed.createdDateTo,
          });
        }
      } catch (e) {
        Logger.error(`Error parsing filter: ${getErrorMessage(e)}`);
      }
    }

    applySort(query, sort, SORT_COLUMN_MAP, 'p.createdOn', 'DESC');

    const [rows, count] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Second pass: batch-load conditions for every profile on the page
    // in a single IN(...) query and group them by profileId in JS.
    // Cheaper than letting TypeORM do a per-row eager join and avoids
    // the pagination-multiplier bug entirely.
    const profileIds = rows.map(r => r.thresholdProfileId);
    const conditionsByProfile = new Map<number, ThresholdCondition[]>();
    if (profileIds.length > 0) {
      const conds = await AppDataSource.getRepository(
        ThresholdCondition,
      ).find({
        where: { thresholdProfileId: In(profileIds) },
        order: { thresholdConditionId: 'ASC' },
      });
      for (const c of conds) {
        if (!conditionsByProfile.has(c.thresholdProfileId)) {
          conditionsByProfile.set(c.thresholdProfileId, []);
        }
        conditionsByProfile.get(c.thresholdProfileId)!.push(c);
      }
    }

    const thresholdProfiles = rows.map((p: any) => {
      const isMutable = p.scope?.code !== 'system';
      return {
        ...p,
        conditions: conditionsByProfile.get(p.thresholdProfileId) ?? [],
        canEdit: isMutable,
        canDelete: isMutable,
      };
    });

    sendResponse(res, true, CODE.SUCCESS, TP_MSG.LIST_FETCHED, {
      count,
      thresholdProfiles,
    });
  } catch (error) {
    Logger.error(
      `Error while listing threshold profiles: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default listThresholdProfile;
