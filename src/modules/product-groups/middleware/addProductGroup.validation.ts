/**
 * AddProductGroupValidation — validates `POST /api/v1/product-groups`.
 *
 * Body shape:
 *   - `code` (required, uppercase + slug pattern)
 *   - `name` (required, 2–128 chars)
 *   - `description` (optional, ≤ 500 chars)
 *   - `isEnabled` (optional, default true)
 *   - `members` (required, ≥ 1 row) — each:
 *       memberType:    'product' (only product members are accepted
 *                       on create; nested group refs land via a
 *                       separate flow)
 *       sourceSystem:  required (e.g. 'UAN', 'AEMS')
 *       level:         required (lowercase: 'ingredient' / 'family' /
 *                       'product_name' / 'trade_name')
 *       name:          required
 *       code:          optional (some catalog rows ship without one)
 *
 * `scopeId` is NOT accepted on the wire — every tenant-created group
 * is forced to the `org` scope (mirrors the threshold-profile copy
 * flow). The controller resolves the scope by stable code at insert
 * time so the id stays correct even if the seed re-numbers.
 *
 * Uniqueness check `(client_id, scope_id, code) WHERE deleted_on IS
 * NULL` runs here against the resolved `org` scope and bails with
 * ALREADY_EXISTS if the tenant already has a group with this code
 * under the org scope. `client_id` comes from `clientData.clientCode`
 * on res.locals — never trust client-supplied `clientId` on the wire.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { IsNull } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  PRODUCT_GROUP as PG_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ProductGroup } from '../../../shared/db/entities/product-group.entity';
import { Scope } from '../../../shared/db/entities/scope.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,63}$/;
const ALLOWED_LEVELS = [
  'ingredient',
  'product_family',
  'product_name',
  'trade_name',
] as const;

const memberSchema = Joi.object({
  memberType: Joi.string().valid('product').required().messages({
    'any.only': 'Only product members are accepted on create',
    'any.required': 'memberType is required',
  }),
  sourceSystem: Joi.string().trim().min(1).max(64).required().messages({
    'string.empty': 'sourceSystem is required',
    'any.required': 'sourceSystem is required',
  }),
  level: Joi.string()
    .trim()
    .lowercase()
    .valid(...ALLOWED_LEVELS)
    .required()
    .messages({
      'any.only': `level must be one of: ${ALLOWED_LEVELS.join(', ')}`,
      'any.required': 'level is required',
    }),
  name: Joi.string().trim().min(1).max(255).required().messages({
    'string.empty': 'name is required',
    'any.required': 'name is required',
  }),
  /* Some catalog rows arrive without a stable id — accept null/empty
   * and persist whatever the FE has. */
  code: Joi.string().trim().max(64).optional().allow('', null),
});

const schema = Joi.object({
  code: Joi.string()
    .trim()
    .uppercase()
    .min(2)
    .max(64)
    .pattern(CODE_PATTERN)
    .required()
    .messages({
      'string.empty': 'Code is required',
      'any.required': 'Code is required',
      'string.min': 'Code must be at least 2 characters',
      'string.max': 'Code must not exceed 64 characters',
      'string.pattern.base':
        'Code must start with a letter/digit and contain only letters, digits, underscores, and hyphens',
    }),
  name: Joi.string().trim().min(2).max(128).required().messages({
    'string.empty': 'Name is required',
    'any.required': 'Name is required',
    'string.min': 'Name must be at least 2 characters',
    'string.max': 'Name must not exceed 128 characters',
  }),
  description: Joi.string().trim().max(500).optional().allow('', null),
  isEnabled: Joi.boolean().optional(),
  members: Joi.array().items(memberSchema).min(1).required().messages({
    'array.min': 'At least one member is required',
    'any.required': 'members is required',
  }),
});

const AddProductGroupValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { error, value } = validateSchema(schema, req.body);
    if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);
    req.body = value;

    /* Resolve the `org` scope by stable code. Tenant-created groups
     * are always org-scoped; the FE doesn't pick a scope. Stamped onto
     * res.locals so the controller doesn't re-query. */
    const orgScope = await AppDataSource.getRepository(Scope).findOne({
      where: { code: 'org' },
    });
    if (!orgScope) {
      Logger.error('Scope with code "org" not found. Did seedScopes run?');
      return sendResponse(res, false, CODE.SERVER_ERROR, PG_MSG.SCOPE_INVALID);
    }
    res.locals.orgScopeId = orgScope.scopeId;

    /* Uniqueness check scoped to the caller's tenant under the org
     * scope. Matches the partial unique index `(COALESCE(client_id,
     * 0), scope_id, code) WHERE deleted_on IS NULL`. */
    const clientCode: string | null =
      res.locals.clientData?.clientCode ?? null;
    const dup = await AppDataSource.getRepository(ProductGroup).findOne({
      where: {
        /* `clientId IS NULL` and `clientId = '...'` need different
         * where shapes in TypeORM. Branch so the uniqueness check
         * mirrors the SQL partial index `(COALESCE(client_id, 0),
         * scope_id, code)`. */
        clientId: clientCode === null ? IsNull() : clientCode,
        scopeId: orgScope.scopeId,
        code: value.code,
        deletedOn: IsNull(),
      },
    });
    if (dup) {
      return sendResponse(
        res,
        false,
        CODE.ALREADY_EXISTS,
        PG_MSG.ALREADY_EXISTS,
      );
    }

    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default AddProductGroupValidation;
