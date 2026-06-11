/**
 * CopyThresholdProfileValidation — validates the request before the
 * controller copies the source profile + its conditions.
 *
 * Checks:
 *   1. `:id` path param resolves to an existing threshold_profile row.
 *      Loads it (with conditions) into `res.locals.sourceProfile` so the
 *      controller doesn't re-query.
 *   2. Body shape — new `code` (required, uppercase code-style),
 *      `displayName` (required), `description` (optional).
 *   3. The new `code` isn't already used by another profile. Uniqueness
 *      is checked globally to keep things simple; if you later need
 *      per-(client, scope) uniqueness (matching the original DDL's
 *      functional unique index), tighten this check.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
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
import { validateSchema } from '../../../shared/utility/validate.middleware';

const PROFILE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,63}$/;

const schema = Joi.object({
  code: Joi.string()
    .trim()
    .uppercase()
    .min(2)
    .max(64)
    .pattern(PROFILE_CODE_PATTERN)
    .required()
    .messages({
      'string.empty': 'Code is required',
      'any.required': 'Code is required',
      'string.min': 'Code must be at least 2 characters',
      'string.max': 'Code must not exceed 64 characters',
      'string.pattern.base':
        'Code must start with a letter/digit and contain only letters, digits, underscores, and hyphens',
    }),
  displayName: Joi.string().trim().min(2).max(128).required().messages({
    'string.empty': 'Display name is required',
    'any.required': 'Display name is required',
    'string.min': 'Display name must be at least 2 characters',
    'string.max': 'Display name must not exceed 128 characters',
  }),
  description: Joi.string().trim().max(500).optional().allow('', null),
});

const CopyThresholdProfileValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Body shape first — fail fast before touching the DB.
    const { error, value } = validateSchema(schema, req.body);
    if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);
    req.body = value;

    const sourceId = Number(req.params.id);
    if (!Number.isInteger(sourceId) || sourceId <= 0) {
      return sendResponse(res, false, CODE.BAD_REQUEST, TP_MSG.NOT_FOUND);
    }

    // Source profile must exist. Load conditions inline so the controller
    // can clone them without a second round-trip.
    const sourceProfile = await AppDataSource.getRepository(ThresholdProfile)
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.conditions', 'conditions')
      .where('p.threshold_profile_id = :id', { id: sourceId })
      .getOne();

    if (!sourceProfile) {
      return sendResponse(res, false, CODE.NOT_FOUND, TP_MSG.NOT_FOUND);
    }

    // New code must be unique. Global uniqueness — tighten to per-
    // (client, scope) later if/when the DDL's functional index is added.
    const dup = await AppDataSource.getRepository(ThresholdProfile).findOne({
      where: { code: value.code },
    });
    if (dup) {
      return sendResponse(
        res,
        false,
        CODE.ALREADY_EXISTS,
        TP_MSG.ALREADY_EXISTS,
      );
    }

    res.locals.sourceProfile = sourceProfile;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default CopyThresholdProfileValidation;
