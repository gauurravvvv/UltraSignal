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
 *   - clientId — set to NULL. The DDL uses bigint for client_id but
 *                UltraSignal's tenant ids are UUIDs, so we can't fill
 *                this in from the JWT today. Defaulting to NULL makes
 *                the copy a "system-visible" row; when the bigint/UUID
 *                mismatch is resolved, tighten this to the caller's
 *                tenant id.
 *   - createdAt — auto-set
 *
 * `category` from the FE payload is informational (the source's scope
 * label) and dropped here. The copy inherits the source's `scopeId`.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  THRESHOLD_PROFILE as TP_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
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

  try {
    const result = await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        const profileRepo = manager.getRepository(ThresholdProfile);
        const conditionRepo = manager.getRepository(ThresholdCondition);

        const copy = profileRepo.create({
          code,
          displayName,
          // Allow caller to override description; fall back to source's
          // value so a copy without an explicit description still has
          // useful context.
          description:
            description !== undefined && description !== null
              ? description
              : sourceProfile.description,
          scopeId: sourceProfile.scopeId,
          clientId: null,
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

    sendResponse(res, true, CODE.SUCCESS, TP_MSG.COPIED, {
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
