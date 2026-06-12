/**
 * SearchProductBrowserValidation — validates the POST search payload.
 *
 *   POST /api/v1/product-browser/search
 *   {
 *     "type": 0 | 1,
 *     "filter": "contains" | "startsWith" | "endsWith" | "exactMatch",
 *     "searchedValue": "paracetamol",
 *     "level": "INGREDIENT" | "PRODUCT_FAMILY" | "PRODUCT_NAME" |
 *              "TRADE_NAME" | "ALL",
 *     "sourceSystem": "UAN"
 *   }
 *
 * `type` mirrors UAN's two modes:
 *   0 = SEARCH — ILIKE the value at `level` (filter mode picks the
 *       wildcard shape — contains / startsWith / endsWith / exactMatch).
 *       `level=ALL` fans out to every category.
 *   1 = HIERARCHY — exact-match the value at `level`, walk the
 *       hierarchy and return related items at every OTHER level. The
 *       `filter` field is ignored under type=1 (hierarchy always uses
 *       `=`). Does NOT support `level=ALL`.
 *
 * Defaults: `type: 0`, `filter: 'contains'` — existing callers that
 * omit either keep behaving as a plain contains-search.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import { GENERIC } from '../../../shared/constants/response.messages';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

export const PRODUCT_BROWSER_LEVELS = [
  'INGREDIENT',
  'PRODUCT_FAMILY',
  'PRODUCT_NAME',
  'TRADE_NAME',
  'ALL',
] as const;

export type ProductBrowserLevel = (typeof PRODUCT_BROWSER_LEVELS)[number];

export const SEARCH_TYPE_SEARCH = 0;
export const SEARCH_TYPE_HIERARCHY = 1;
export type ProductBrowserSearchType =
  | typeof SEARCH_TYPE_SEARCH
  | typeof SEARCH_TYPE_HIERARCHY;

export const PRODUCT_BROWSER_FILTERS = [
  'contains',
  'startsWith',
  'endsWith',
  'exactMatch',
] as const;

export type ProductBrowserFilter = (typeof PRODUCT_BROWSER_FILTERS)[number];

const schema = Joi.object({
  type: Joi.number()
    .valid(SEARCH_TYPE_SEARCH, SEARCH_TYPE_HIERARCHY)
    .default(SEARCH_TYPE_SEARCH)
    .messages({
      'any.only': 'type must be 0 (search) or 1 (hierarchy)',
    }),
  filter: Joi.string()
    .valid(...PRODUCT_BROWSER_FILTERS)
    .default('contains')
    .messages({
      'any.only': `filter must be one of: ${PRODUCT_BROWSER_FILTERS.join(', ')}`,
    }),
  searchedValue: Joi.string().trim().min(1).max(255).required().messages({
    'string.empty': 'searchedValue is required',
    'any.required': 'searchedValue is required',
  }),
  level: Joi.string()
    .valid(...PRODUCT_BROWSER_LEVELS)
    .required()
    .messages({
      'any.only': `level must be one of: ${PRODUCT_BROWSER_LEVELS.join(', ')}`,
      'any.required': 'level is required',
    }),
  /**
   * sourceSystem is required ONLY for type=1 (hierarchy walk) — that
   * mode anchors on an exact term and the FE wants to scope siblings
   * to a single upstream system. For type=0 (ILIKE search) it's
   * optional; when omitted, the controller fans out across every
   * source_system so the user sees all matches in one shot.
   */
  sourceSystem: Joi.string()
    .trim()
    .min(1)
    .max(64)
    .when('type', {
      is: SEARCH_TYPE_HIERARCHY,
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .messages({
      'string.empty': 'sourceSystem is required',
      'any.required': 'sourceSystem is required for type=1 (hierarchy)',
    }),
}).custom((value, helpers) => {
  if (value.type === SEARCH_TYPE_HIERARCHY && value.level === 'ALL') {
    return helpers.error('any.invalid', {
      message:
        'level=ALL is not allowed with type=1 (hierarchy). Pick a specific level.',
    });
  }
  return value;
});

const SearchProductBrowserValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { error, value } = validateSchema(schema, req.body);
    if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);
    req.body = value;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default SearchProductBrowserValidation;
