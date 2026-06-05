import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import { buildSortJoi } from '../../../shared/utility/listSort';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

export const PRODUCT_LIST_SORT_FIELDS = [
  'ingredient',
  'prodNameDisplay',
  'tradeNameDisplay',
  'country',
] as const;
export type ProductListSortField = (typeof PRODUCT_LIST_SORT_FIELDS)[number];

const ListProductValidation = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(1000).optional(),
    filter: Joi.string().optional().allow(''),
    search: Joi.string().trim().max(200).optional().allow(''),
    sourceId: Joi.alternatives()
      .try(Joi.number().integer(), Joi.string().allow(''))
      .optional(),
    sort: buildSortJoi(PRODUCT_LIST_SORT_FIELDS).optional(),
  }).unknown(false);

  const { error, value } = validateSchema(schema, req.query);
  if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);

  req.query = value;
  next();
};

export default ListProductValidation;
