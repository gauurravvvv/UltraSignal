/**
 * ListEventGroupValidation — validates pagination, sort, and filter.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import { buildSortJoi } from '../../../shared/utility/listSort';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

export const EVENT_GROUP_LIST_SORT_FIELDS = [
  'name',
  'status',
  'createdOn',
] as const;
export type EventGroupListSortField =
  (typeof EVENT_GROUP_LIST_SORT_FIELDS)[number];

const ListEventGroupValidation = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(1000).optional(),
    filter: Joi.string().optional().allow(''),
    sourceId: Joi.alternatives()
      .try(Joi.number().integer(), Joi.string().allow(''))
      .optional(),
    sort: buildSortJoi(EVENT_GROUP_LIST_SORT_FIELDS).optional(),
  }).unknown(false);

  const { error, value } = validateSchema(schema, req.query);
  if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);

  req.query = value;
  next();
};

export default ListEventGroupValidation;
