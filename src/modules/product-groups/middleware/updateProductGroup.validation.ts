/**
 * UpdateProductGroupValidation — `PUT /api/v1/product-groups/:id`.
 *
 * Body shape (all but `members` optional):
 *   - `name`        — 2–128 chars
 *   - `description` — ≤ 500 chars (allow '' / null to clear)
 *   - `isEnabled`   — boolean
 *   - `members`     — REQUIRED on every update. Wholesale replace; the
 *                     prior member rows are soft-deleted and the new
 *                     set is inserted in the same transaction. At
 *                     least one row required. Per-row shape matches
 *                     the Add validator (memberType='product',
 *                     sourceSystem, level, name; code optional).
 *
 * `code` is intentionally NOT accepted on update — it's the stable
 * identifier referenced by nested `product_group_member.group` rows
 * and editing it would orphan those references. The threshold-profile
 * update endpoint uses the same convention.
 *
 * `scopeId` is also rejected — tenant-created groups stay org-scoped
 * for life. Changing scope mid-lifecycle is a future migration flow.
 *
 * Enforces mutability:
 *   - 404 if the group is missing or soft-deleted
 *   - 403 if the group is system-scope OR belongs to another client
 *
 * Loads the group + caller-owned scope onto res.locals so the
 * controller doesn't re-query.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { IsNull, Not } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  PRODUCT_GROUP as PG_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ProductGroup } from '../../../shared/db/entities/product-group.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const ALLOWED_LEVELS = [
  'ingredient',
  'product_family',
  'product_name',
  'trade_name',
] as const;

const memberSchema = Joi.object({
  memberType: Joi.string().valid('product').required().messages({
    'any.only': 'Only product members are accepted on update',
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
  code: Joi.string().trim().max(64).optional().allow('', null),
});

const schema = Joi.object({
  name: Joi.string().trim().min(2).max(128).optional().messages({
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

const UpdateProductGroupValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return sendResponse(res, false, CODE.BAD_REQUEST, PG_MSG.NOT_FOUND);
    }

    const { error, value } = validateSchema(schema, req.body);
    if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);
    req.body = value;

    /* Resolve the target row. Soft-deleted rows are treated as
     * missing — the FE shouldn't be able to PUT them back to life
     * via this endpoint. */
    const group = await AppDataSource.getRepository(ProductGroup)
      .createQueryBuilder('pg')
      .leftJoinAndSelect('pg.scope', 'scope')
      .where('pg.product_group_id = :id', { id })
      .andWhere('pg.deleted_on IS NULL')
      .getOne();

    if (!group) {
      return sendResponse(res, false, CODE.NOT_FOUND, PG_MSG.NOT_FOUND);
    }

    /* Server-side mutability check — the FE already hides Edit on
     * canEdit:false, but the BE re-runs the rule so a hand-rolled
     * request can't bypass it. */
    const callerClientCode: string | null =
      res.locals.clientData?.clientCode ?? null;
    const isSystem = group.scope?.code === 'system';
    const ownsRow =
      !!callerClientCode && group.clientId === callerClientCode;
    if (isSystem || !ownsRow) {
      return sendResponse(res, false, CODE.FORBIDDEN, PG_MSG.IMMUTABLE);
    }

    /* If the name changes, double-check there's no other live group
     * with the same code at this (client, scope). Code itself is
     * immutable so we don't recheck it — but a name change can still
     * collide with a stale soft-deleted row's name if anyone tries
     * to restore it. Cheap insurance. */
    if (value.name && value.name !== group.name) {
      const collision = await AppDataSource.getRepository(ProductGroup).findOne(
        {
          where: {
            clientId:
              callerClientCode === null ? IsNull() : callerClientCode,
            scopeId: group.scopeId,
            name: value.name,
            productGroupId: Not(id),
            deletedOn: IsNull(),
          },
        },
      );
      if (collision) {
        return sendResponse(
          res,
          false,
          CODE.ALREADY_EXISTS,
          PG_MSG.ALREADY_EXISTS,
        );
      }
    }

    res.locals.productGroup = group;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default UpdateProductGroupValidation;
