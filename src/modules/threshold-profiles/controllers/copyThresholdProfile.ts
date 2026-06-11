/**
 * copyThresholdProfile — clones a threshold profile and persists the
 * (possibly edited) condition set the FE submits.
 *
 * Source profile is pre-loaded into `res.locals.sourceProfile` by the
 * validator (with the `conditions` relation eagerly joined), so this
 * controller is pure write logic.
 *
 * Condition handling:
 *   - If the body carries `methods` (the FE's edited rows), insert one
 *     condition row per entry using its (metric, operator, value,
 *     isEnabled). The `id` echoed back from the source row is ignored
 *     — new rows get fresh auto-increment ids.
 *   - If `methods` is omitted, fall back to cloning the source's
 *     conditions verbatim (the original copy semantics).
 *
 * Transaction wraps the whole thing — if condition inserts fail, the
 * new profile row rolls back too, so we never leave an orphan parent.
 *
 * What changes vs. the source:
 *   - thresholdProfileId — fresh auto-increment
 *   - thresholdConditionId — fresh per row
 *   - code, displayName — from the caller's payload
 *   - description — caller's payload if provided, source's otherwise
 *   - isDefault — forced to FALSE. Only seeded profiles can be defaults;
 *                 user-created copies are never defaults.
 *   - scopeId — set to the `org` scope (looked up by code). System
 *               profiles are platform-defined and read-only; any user
 *               copy becomes a tenant-owned, editable org-scoped row.
 *   - clientId — set to the caller's `clientCode` (e.g. 'UG'). The
 *                column stores the 4-char code directly so the row
 *                ties back to the originating tenant without depending
 *                on the UUID-keyed `client` table.
 *   - createdAt — auto-set
 *
 * `category` from the FE payload is informational (the source's scope
 * label) and dropped here.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  THRESHOLD_PROFILE as TP_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { Scope } from '../../../shared/db/entities/scope.entity';
import { ThresholdCondition } from '../../../shared/db/entities/threshold-condition.entity';
import { ThresholdProfile } from '../../../shared/db/entities/threshold-profile.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

interface MethodInput {
  id?: number;
  metric: string;
  operator: string;
  value: number;
  isEnabled: boolean;
}

interface CopyBody {
  code: string;
  displayName: string;
  description?: string | null;
  category?: string | null;
  methods?: MethodInput[];
}

const copyThresholdProfile = async (req: Request, res: Response) => {
  Logger.info('Copy Threshold Profile request');

  const { code, displayName, description, methods } = req.body as CopyBody;
  const sourceProfile = res.locals.sourceProfile as ThresholdProfile;
  const { clientData } = res.locals;

  try {
    const result = await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        const profileRepo = manager.getRepository(ThresholdProfile);
        const conditionRepo = manager.getRepository(ThresholdCondition);
        const scopeRepo = manager.getRepository(Scope);

        // User-created profiles are org-scoped, regardless of where they
        // were copied from. Look up the `org` scope by its stable code
        // rather than hard-coding a numeric id (auto-increment ids can
        // drift between environments).
        const orgScope = await scopeRepo.findOne({ where: { code: 'org' } });
        if (!orgScope) {
          throw new Error(
            'Scope with code "org" not found. Did seedScopes run?',
          );
        }

        const copy = profileRepo.create({
          code,
          displayName,
          // Take description exactly as the caller supplies it. Empty
          // / null collapses to undefined so the column stays NULL
          // until the user types something. The previous behaviour of
          // inheriting from the source was confusing because every
          // copy of the STANDARD profile ended up echoing the same
          // built-in description until the user manually cleared it.
          description: description ?? undefined,
          scopeId: orgScope.scopeId,
          // Caller's tenant code stamped on the row so the copy is
          // identifiable as that tenant's.
          clientId: clientData?.clientCode ?? null,
          isDefault: false,
          isEnabled: sourceProfile.isEnabled,
        });
        const savedProfile = await profileRepo.save(copy);

        // Pick the condition set to insert. If the FE sent edited rows,
        // use those (the user adjusted toggles / values on the form);
        // otherwise clone the source verbatim.
        const sourceRows: MethodInput[] =
          methods && methods.length > 0
            ? methods
            : (sourceProfile.conditions ?? []).map(c => ({
                metric: c.metric,
                operator: c.operator,
                value: c.value,
                isEnabled: c.isEnabled,
              }));

        const conditions = sourceRows.map(m =>
          conditionRepo.create({
            thresholdProfileId: savedProfile.thresholdProfileId,
            metric: m.metric,
            operator: m.operator,
            value: m.value,
            isEnabled: m.isEnabled,
          }),
        );

        const savedConditions =
          conditions.length > 0 ? await conditionRepo.save(conditions) : [];

        return { profile: savedProfile, conditions: savedConditions };
      },
    );

    sendResponse(res, true, CODE.SUCCESS, TP_MSG.SAVED, {
      ...result.profile,
      conditions: result.conditions,
    });
  } catch (error) {
    Logger.error(
      `Error copying threshold profile: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default copyThresholdProfile;
