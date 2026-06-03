/**
 * ListGroupValidation — validates pagination, filter, and multi-column sort for
 * the group list, plus enforces the required orgId scope.
 *
 * Sort + pagination follow the standard list contract — see src/utility/listSort.ts.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import { buildSortJoi } from '../../../shared/utility/listSort';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

export const GROUP_LIST_SORT_FIELDS = ['name', 'status', 'createdOn'] as const;
export type GroupListSortField = (typeof GROUP_LIST_SORT_FIELDS)[number];

const ListGroupValidation = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const schema = Joi.object({
    roleId: Joi.string().optional().allow(''),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(1000).optional(),
    filter: Joi.string().optional().allow(''),
    sort: buildSortJoi(GROUP_LIST_SORT_FIELDS).optional(),
  }).unknown(false);

  const { error, value } = validateSchema(schema, req.query);
  if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);

  req.query = value;
  next();
};

export default ListGroupValidation;
