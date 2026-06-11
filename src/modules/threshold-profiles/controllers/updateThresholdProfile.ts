/**
 * updateThresholdProfile — applies the validated partial update.
 *
 * Source row + scope are pre-loaded into `res.locals.thresholdProfile`
 * by the validator (which also rejects system-scope rows with 403, so
 * by the time this controller runs we know the row is mutable).
 *
 * Method handling:
 *   - `methods` omitted             → conditions untouched
 *   - `methods: []`                 → wipe all conditions
 *   - `methods: [..., ...]`         → wholesale-replace condition set
 *
 * Wrapped in a single transaction so a half-applied edit can't leave
 * the profile with a stale half of the previous conditions.
 *
 * Response echoes the saved row in the same shape `GET /:id` returns —
 * full profile + scope + conditions + recomputed `canEdit`/`canDelete`.
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

interface UpdateBody {
  id: number;
  displayName?: string;
  code?: string;
  description?: string | null;
  status?: 0 | 1;
  methods?: MethodInput[];
}

const updateThresholdProfile = async (req: Request, res: Response) => {
  Logger.info('Update Threshold Profile request');

  const { displayName, code, description, status, methods } =
    req.body as UpdateBody;
  const profile = res.locals.thresholdProfile as ThresholdProfile;

  try {
    await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        if (displayName !== undefined) profile.displayName = displayName;
        if (code !== undefined) profile.code = code;
        if (description !== undefined) {
          // Caller explicitly cleared description with '' or null — store
          // as-is so it doesn't keep echoing the old text.
          profile.description = description ?? undefined;
        }
        if (status !== undefined) profile.isEnabled = status === 1;
        await manager.getRepository(ThresholdProfile).save(profile);

        if (Array.isArray(methods)) {
          // Wholesale-replace the condition set. CASCADE on the FK
          // means we could delete-then-insert in either order, but
          // delete-first keeps the timeline cleaner.
          await manager
            .getRepository(ThresholdCondition)
            .delete({ thresholdProfileId: profile.thresholdProfileId });

          if (methods.length > 0) {
            const conditionRepo = manager.getRepository(ThresholdCondition);
            const rows = methods.map(m =>
              conditionRepo.create({
                thresholdProfileId: profile.thresholdProfileId,
                metric: m.metric,
                operator: m.operator,
                value: m.value,
                isEnabled: m.isEnabled,
              }),
            );
            await conditionRepo.save(rows);
          }
        }
      },
    );

    // Reload with scope + conditions for the response. Same shape as
    // GET /:id so the FE doesn't need a second call.
    const saved = await AppDataSource.getRepository(ThresholdProfile)
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.scope', 'scope')
      .leftJoinAndSelect('p.conditions', 'conditions')
      .where('p.threshold_profile_id = :id', {
        id: profile.thresholdProfileId,
      })
      .orderBy('conditions.thresholdConditionId', 'ASC')
      .getOne();

    const isMutable = saved?.scope?.code !== 'system';

    sendResponse(res, true, CODE.SUCCESS, TP_MSG.UPDATED, {
      ...saved,
      canEdit: isMutable,
      canDelete: isMutable,
    });
  } catch (error) {
    Logger.error(
      `Error updating threshold profile: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default updateThresholdProfile;
