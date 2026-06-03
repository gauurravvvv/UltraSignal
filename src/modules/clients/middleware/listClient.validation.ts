/**
 * ListClientValidation — validates pagination + multi-column sort
 * query params for the client list endpoint.
 *
 * Authorisation is enforced upstream by `VerifyPermissionMiddleware('clientManagement')`
 * in the clients router; this middleware is now payload-only.
 *
 * Sort + pagination follow the standard list contract — see src/utility/listSort.ts.
 * Each list endpoint declares its own column whitelist; only the per-module fields
 * live here.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import { buildSortJoi } from '../../../shared/utility/listSort';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

export const ORG_LIST_SORT_FIELDS = ['name', 'status', 'createdOn'] as const;
export type ClientListSortField = (typeof ORG_LIST_SORT_FIELDS)[number];

const ListClientValidation = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(1000).optional(),
    filter: Joi.string().optional().allow(''),
    sort: buildSortJoi(ORG_LIST_SORT_FIELDS).optional(),
  }).unknown(false);

  const { error, value } = validateSchema(schema, req.query);
  if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);

  req.query = value;
  next();
};

export default ListClientValidation;
