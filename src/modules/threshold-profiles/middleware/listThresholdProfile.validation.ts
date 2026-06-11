/**
 * ListThresholdProfileValidation — validates pagination + sort query
 * params. The `filter` blob is JSON-encoded and parsed by the
 * controller in a try/catch (malformed JSON degrades to "unfiltered
 * list" rather than 400 — same convention as
 * `listDataSource.validation.ts`).
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE, MAX_ROW } from '../../../../config/config';
import { GENERIC } from '../../../shared/constants/response.messages';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

export type ThresholdProfileListSortField =
  | 'displayName'
  | 'code'
  | 'isEnabled'
  | 'createdOn';

const ALLOWED_SORT_FIELDS: ThresholdProfileListSortField[] = [
  'displayName',
  'code',
  'isEnabled',
  'createdOn',
];

const schema = Joi.object({
  limit: Joi.number().integer().min(1).max(MAX_ROW).optional(),
  page: Joi.number().integer().min(1).optional(),
  filter: Joi.string().optional(),
  sort: Joi.string()
    .pattern(/^(\w+):(asc|desc)$/i)
    .optional()
    .messages({
      'string.pattern.base':
        'sort must be in the form `<field>:asc` or `<field>:desc`',
    }),
}).custom((value, helpers) => {
  if (value.sort) {
    const [field] = value.sort.split(':');
    if (
      !ALLOWED_SORT_FIELDS.includes(field as ThresholdProfileListSortField)
    ) {
      return helpers.error('any.invalid', {
        message: `sort field must be one of: ${ALLOWED_SORT_FIELDS.join(', ')}`,
      });
    }
  }
  return value;
});

const ListThresholdProfileValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { error, value } = validateSchema(schema, req.query);
    if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);
    req.query = value;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default ListThresholdProfileValidation;
