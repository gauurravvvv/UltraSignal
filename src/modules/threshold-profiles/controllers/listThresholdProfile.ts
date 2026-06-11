/**
 * listThresholdProfile — returns every threshold profile in the catalog
 * along with its conditions (the (metric, operator, value) tuples that
 * the profile bundles) and its parent scope.
 *
 * The FK `threshold_condition.threshold_profile_id` is what drives the
 * grouping; TypeORM's `@OneToMany` on `ThresholdProfile.conditions`
 * resolves it via `leftJoinAndSelect`, so the response is a flat
 * array of profiles each with its `conditions` array nested inline.
 *
 * Each row carries `canEdit` / `canDelete` flags so the FE can render
 * action buttons consistently: system-scope profiles (`scope.code ===
 * 'system'`) are read-only — they're shared across tenants and can't
 * be mutated. The same flag pattern is used by users / roles / groups.
 *
 * No pagination, no filtering — this list is small (system-default +
 * a handful of tenant overrides). If it grows, add `page` / `limit` /
 * filter params following the data-sources pattern.
 *
 * Order:
 *   - profiles by `thresholdProfileId ASC` (insertion order)
 *   - conditions within each profile by `thresholdConditionId ASC`
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  THRESHOLD_PROFILE as TP_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ThresholdProfile } from '../../../shared/db/entities/threshold-profile.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const listThresholdProfile = async (req: Request, res: Response) => {
  Logger.info('List Threshold Profiles request');

  try {
    const profiles = await AppDataSource.getRepository(ThresholdProfile)
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.scope', 'scope')
      .leftJoinAndSelect('p.conditions', 'conditions')
      .orderBy('p.threshold_profile_id', 'ASC')
      .addOrderBy('conditions.threshold_condition_id', 'ASC')
      .getMany();

    // System-scope profiles are platform-defined and shared across
    // tenants. They appear in every tenant's list (so the user can
    // pick / copy them) but cannot be edited or deleted.
    const thresholdProfiles = profiles.map((p: any) => {
      const isMutable = p.scope?.code !== 'system';
      return { ...p, canEdit: isMutable, canDelete: isMutable };
    });

    sendResponse(res, true, CODE.SUCCESS, TP_MSG.LIST_FETCHED, {
      count: thresholdProfiles.length,
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
