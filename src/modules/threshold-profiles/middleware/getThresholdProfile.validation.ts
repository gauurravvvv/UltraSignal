/**
 * GetThresholdProfileValidation — resolves the threshold profile and
 * pre-loads its conditions + scope, so the controller is pure response
 * shaping. Used by the "click Copy → prefill the form" flow on the FE.
 *
 * `:id` must parse as a positive integer; anything else returns 400
 * before we touch the DB.
 */
import { NextFunction, Request, Response } from 'express';
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

const GetThresholdProfileValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return sendResponse(res, false, CODE.BAD_REQUEST, TP_MSG.NOT_FOUND);
    }

    const profile = await AppDataSource.getRepository(ThresholdProfile)
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.scope', 'scope')
      .leftJoinAndSelect('p.conditions', 'conditions')
      .where('p.threshold_profile_id = :id', { id })
      .orderBy('conditions.threshold_condition_id', 'ASC')
      .getOne();

    if (!profile) {
      return sendResponse(res, false, CODE.NOT_FOUND, TP_MSG.NOT_FOUND);
    }

    res.locals.thresholdProfile = profile;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default GetThresholdProfileValidation;
