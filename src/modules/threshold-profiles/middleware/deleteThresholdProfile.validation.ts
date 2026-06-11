/**
 * DeleteThresholdProfileValidation — verifies the row exists, scopes
 * out system rows, and pre-loads the entity for the controller.
 *
 * System-scope rule mirrors the Update guard: rows with
 * `scope.code === 'system'` return 403 — they're platform-defined and
 * shared across every tenant, so deletion is not allowed.
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

const DeleteThresholdProfileValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return sendResponse(res, false, CODE.BAD_REQUEST, TP_MSG.NOT_FOUND);
    }

    const existing = await AppDataSource.getRepository(ThresholdProfile)
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.scope', 'scope')
      .where('p.threshold_profile_id = :id', { id })
      .getOne();

    if (!existing) {
      return sendResponse(res, false, CODE.NOT_FOUND, TP_MSG.NOT_FOUND);
    }

    if (existing.scope?.code === 'system') {
      return sendResponse(
        res,
        false,
        CODE.UNAUTHORIZED,
        TP_MSG.SYSTEM_IMMUTABLE,
      );
    }

    res.locals.thresholdProfile = existing;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default DeleteThresholdProfileValidation;
