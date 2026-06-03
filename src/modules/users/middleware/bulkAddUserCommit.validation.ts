/**
 * BulkAddUserCommitValidation — Joi-validates the JSON body of the commit
 * endpoint. The body MUST be a list of fully-resolved users (with groupIds,
 * not groupNames) — typically the `valid[]` array returned from /validate.
 *
 * We don't re-run the full per-row schema here (validate already did that);
 * we only assert the shape so the controller can trust the structure. The
 * controller itself re-runs DB uniqueness + group existence as a race-safety
 * net.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import { SUPPORTED_LOCALES } from '../../../shared/utility/i18n';
import { fields } from '../../../shared/utility/joi.schemas';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const MAX_USERS_PER_COMMIT = 500;

const userEntry = Joi.object({
  row: Joi.number().integer().min(1).required(),
  email: fields.email.required(),
  username: fields.username.required(),
  firstName: fields.firstName.required(),
  lastName: fields.lastName.required(),
  groupIds: Joi.array().items(fields.id).min(1).required(),
  // groupNames is informational only (echoed from /validate for FE display);
  // the BE trusts groupIds and ignores groupNames at commit time.
  groupNames: Joi.array().items(Joi.string()).optional(),
  locale: Joi.string()
    .valid(...SUPPORTED_LOCALES)
    .default('en'),
}).unknown(false);

const schema = Joi.object({
  users: Joi.array()
    .items(userEntry)
    .min(1)
    .max(MAX_USERS_PER_COMMIT)
    .required()
    .messages({
      'array.min': 'No users to create',
      'array.max': `Cannot create more than ${MAX_USERS_PER_COMMIT} users in a single request`,
    }),
});

const BulkAddUserCommitValidation = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { error, value } = validateSchema(schema, req.body);
  if (error) {
    return sendResponse(res, false, CODE.BAD_REQUEST, error);
  }
  req.body = value;
  next();
};

export default BulkAddUserCommitValidation;
