/**
 * UpdateThresholdProfileValidation — validates the partial-update
 * payload, blocks fields that mustn't be touched, and stamps the
 * pre-loaded profile (with scope) into `res.locals.thresholdProfile`.
 *
 * Forbidden fields (returns 400 if present so the FE knows to drop
 * them):
 *   - `scopeId`     — scope is immutable after creation, mirrors the
 *                     `typeId` forbid on data-sources PUT
 *   - `isDefault`   — only seeded profiles can be defaults
 *   - `clientId`    — ownership stays where the BE put it
 *
 * System-scope rule: if the source row's `scope.code === 'system'`,
 * return 403 BEFORE letting the controller touch anything. The FE
 * already hides the Edit button on system rows via the `canEdit`
 * flag from list / get; this is the server-side enforcement.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { Not } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  THRESHOLD_PROFILE as TP_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ThresholdProfile } from '../../../shared/db/entities/threshold-profile.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { fields } from '../../../shared/utility/joi.schemas';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const PROFILE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,63}$/;
const ALLOWED_OPERATORS = ['>=', '<=', '>', '<', '=', '!='] as const;

const methodSchema = Joi.object({
  id: Joi.number().integer().positive().optional(),
  metric: Joi.string().trim().min(1).max(64).required(),
  operator: Joi.string()
    .trim()
    .valid(...ALLOWED_OPERATORS)
    .required()
    .messages({
      'any.only': `Operator must be one of: ${ALLOWED_OPERATORS.join(', ')}`,
    }),
  value: Joi.number().required(),
  isEnabled: Joi.boolean().required(),
});

const schema = Joi.object({
  id: Joi.number().integer().positive().required(),
  displayName: Joi.string().trim().min(2).max(128).optional(),
  code: Joi.string()
    .trim()
    .uppercase()
    .min(2)
    .max(64)
    .pattern(PROFILE_CODE_PATTERN)
    .optional()
    .messages({
      'string.pattern.base':
        'Code must start with a letter/digit and contain only letters, digits, underscores, and hyphens',
    }),
  description: fields.description.optional().allow('', null),
  status: Joi.number().valid(0, 1).optional(),
  methods: Joi.array().items(methodSchema).optional(),
  // Immutable fields — explicit forbid so the FE gets a clear 400.
  scopeId: Joi.any().forbidden().messages({
    'any.unknown':
      'Scope cannot be changed after creation. Remove `scopeId` from the payload.',
  }),
  isDefault: Joi.any().forbidden().messages({
    'any.unknown': 'isDefault cannot be set through this endpoint.',
  }),
  clientId: Joi.any().forbidden().messages({
    'any.unknown': 'clientId cannot be set through this endpoint.',
  }),
});

const UpdateThresholdProfileValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { error, value } = validateSchema(schema, req.body);
    if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);
    req.body = value;

    const { id, code } = value;

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

    if (code) {
      const dup = await AppDataSource.getRepository(ThresholdProfile).findOne({
        where: { thresholdProfileId: Not(id), code },
      });
      if (dup) {
        return sendResponse(
          res,
          false,
          CODE.ALREADY_EXISTS,
          TP_MSG.ALREADY_EXISTS,
        );
      }
    }

    res.locals.thresholdProfile = existing;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default UpdateThresholdProfileValidation;
