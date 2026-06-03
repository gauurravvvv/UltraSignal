/**
 * ListUserValidation — validates pagination, filter, and multi-column sort
 * for the org-user list.
 *
 * Sort + pagination follow the standard list contract — see src/utility/listSort.ts.
 * Org id is NOT accepted from the client — it is sourced from
 * `res.locals.orgData.id` (signed JWT). SanitizeOrgInputMiddleware
 * strips any inbound `orgId` / `organisationId` / `organisation`
 * keys before this validator runs. groupId is optional.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import { buildSortJoi } from '../../../shared/utility/listSort';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

export const USER_LIST_SORT_FIELDS = [
  'username',
  'firstName',
  'lastName',
  'email',
  'lastLogin',
  'status',
  'createdOn',
] as const;
export type UserListSortField = (typeof USER_LIST_SORT_FIELDS)[number];

const ListUserValidation = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const schema = Joi.object({
    groupId: Joi.string().optional().allow(''),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(1000).optional(),
    filter: Joi.string().optional().allow(''),
    sort: buildSortJoi(USER_LIST_SORT_FIELDS).optional(),
  }).unknown(false);

  const { error, value } = validateSchema(schema, req.query);
  if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);

  req.query = value;
  next();
};

export default ListUserValidation;
