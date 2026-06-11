/**
 * getThresholdProfile — returns one profile (with scope + conditions
 * inline) for the "click Copy → prefill the form" flow.
 *
 * Carries the same `canEdit` / `canDelete` flags as the list response
 * so the FE doesn't have to recompute the read-only rule on the detail
 * screen. System-scope profiles are non-mutable.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  THRESHOLD_PROFILE as TP_MSG,
} from '../../../shared/constants/response.messages';
import { ThresholdProfile } from '../../../shared/db/entities/threshold-profile.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const getThresholdProfile = async (req: Request, res: Response) => {
  Logger.info('Get Threshold Profile request');

  const profile = res.locals.thresholdProfile as ThresholdProfile & {
    scope?: { code: string };
  };

  try {
    const isMutable = profile.scope?.code !== 'system';

    sendResponse(res, true, CODE.SUCCESS, TP_MSG.FETCHED, {
      ...profile,
      canEdit: isMutable,
      canDelete: isMutable,
    });
  } catch (error) {
    Logger.error(`Error fetching threshold profile: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default getThresholdProfile;
