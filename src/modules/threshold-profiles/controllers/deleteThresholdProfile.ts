/**
 * deleteThresholdProfile — hard-deletes the profile row. Conditions
 * cascade out via the FK on `threshold_condition.threshold_profile_id`
 * (declared `onDelete: 'CASCADE'` on the entity), so we don't need to
 * delete conditions manually.
 *
 * The `ThresholdProfile` entity has no `@DeleteDateColumn`, so this is
 * a hard delete — not a soft delete like roles / groups. If you want
 * to retain history later, add `@DeleteDateColumn` to the entity and
 * switch this controller from `.delete(id)` to `.softDelete(id)`.
 *
 * System-scope rejection happens in the validator (returns 403 before
 * this controller runs), so by the time we're here the row is known
 * to be tenant-owned and safe to delete.
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

const deleteThresholdProfile = async (req: Request, res: Response) => {
  Logger.info('Delete Threshold Profile request');

  const profile = res.locals.thresholdProfile as ThresholdProfile;

  try {
    await AppDataSource.getRepository(ThresholdProfile).delete(
      profile.thresholdProfileId,
    );

    sendResponse(res, true, CODE.SUCCESS, TP_MSG.DELETED);
  } catch (error) {
    Logger.error(
      `Error deleting threshold profile: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default deleteThresholdProfile;
