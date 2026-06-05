import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import { buildSortJoi } from '../../../shared/utility/listSort';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

export const EVENT_LIST_SORT_FIELDS = [
  'socName',
  'hlgtName',
  'hltName',
  'ptName',
  'lltName',
] as const;
export type EventListSortField = (typeof EVENT_LIST_SORT_FIELDS)[number];

const ListEventValidation = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(1000).optional(),
    search: Joi.string().trim().max(200).optional().allow(''),
    level: Joi.string()
      .trim()
      .uppercase()
      .valid('SOC', 'HLGT', 'HLT', 'PT', 'LLT', 'SMQ')
      .optional(),
    language: Joi.string().trim().lowercase().max(10).optional(),
    sort: buildSortJoi(EVENT_LIST_SORT_FIELDS).optional(),
  }).unknown(false);

  const { error, value } = validateSchema(schema, req.query);
  if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);

  req.query = value;
  next();
};

export default ListEventValidation;
