/**
 * ListProductBrowserValidation — validates the query for the product
 * browser search:
 *
 *   GET /api/v1/product-browser
 *     ?level=ingredient|family|product|trade
 *     &product=<search-term>
 *     &sourceSystem=<source>
 *     [&page=<n>&limit=<n>]
 *
 * `level` tells the controller which `<x>_name` column to ILIKE the
 * search term against. Keep this whitelist in sync with the
 * `COLUMN_BY_LEVEL` map in `listProductBrowser.ts` — both sides drive
 * the same SQL-column choice.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE, MAX_ROW } from '../../../../config/config';
import { GENERIC } from '../../../shared/constants/response.messages';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

export const VALID_LEVELS = [
  'ingredient',
  'family',
  'product',
  'trade',
] as const;

export type ProductBrowserLevel = (typeof VALID_LEVELS)[number];

const schema = Joi.object({
  level: Joi.string()
    .valid(...VALID_LEVELS)
    .required()
    .messages({
      'any.only': `level must be one of: ${VALID_LEVELS.join(', ')}`,
      'any.required': 'level is required',
    }),
  product: Joi.string().trim().min(1).max(255).required().messages({
    'string.empty': 'product is required',
    'any.required': 'product is required',
  }),
  sourceSystem: Joi.string().trim().min(1).max(64).required().messages({
    'string.empty': 'sourceSystem is required',
    'any.required': 'sourceSystem is required',
  }),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(MAX_ROW).optional(),
});

const ListProductBrowserValidation = async (
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

export default ListProductBrowserValidation;
