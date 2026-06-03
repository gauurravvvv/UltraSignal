/**
 * ListSystemAdminValidation — validates pagination + multi-column sort for
 * GET /system-admin/list. Authorisation is enforced upstream by
 * `VerifyPermissionMiddleware('systemAdmin')`; this middleware is payload-only.
 *
 * Sort + pagination follow the standard list contract — see src/utility/listSort.ts.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import { buildSortJoi } from '../../../shared/utility/listSort';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

export const SYSTEM_ADMIN_LIST_SORT_FIELDS = [
  'username',
  'firstName',
  'lastName',
  'email',
  'lastLogin',
  'status',
  'createdOn',
] as const;
export type SystemAdminListSortField =
  (typeof SYSTEM_ADMIN_LIST_SORT_FIELDS)[number];

const ListSystemAdminValidation = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(1000).optional(),
    filter: Joi.string().optional().allow(''),
    sort: buildSortJoi(SYSTEM_ADMIN_LIST_SORT_FIELDS).optional(),
  }).unknown(false);

  const { error, value } = validateSchema(schema, req.query);
  if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);

  req.query = value;
  next();
};

export default ListSystemAdminValidation;
