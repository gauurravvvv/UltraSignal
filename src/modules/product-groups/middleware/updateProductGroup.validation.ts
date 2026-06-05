/**
 * UpdateProductGroupValidation — enforces:
 *  - record-level ownership (only creator or admin override can edit;
 *    matches the requirement "Only relevant users should have access to
 *    update existing Product Group")
 *  - duplicate-name check across other groups in the same tenant
 *  - all members reference real ProductBrowser rows in this tenant
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { In, Not } from 'typeorm';
import { CODE, IS_DEFAULT } from '../../../../config/config';
import {
  GENERIC,
  PRODUCT_GROUP as PG_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ProductBrowser } from '../../../shared/db/entities/products.entity';
import { ProductGroup } from '../../../shared/db/entities/productGroup.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { fields } from '../../../shared/utility/joi.schemas';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const memberSchema = Joi.object({
  memberId: fields.id.required(),
  level: Joi.string()
    .trim()
    .lowercase()
    .valid('ingredient', 'product', 'trade')
    .optional(),
  language: Joi.string().trim().lowercase().max(10).optional(),
  sourceId: Joi.number().integer().optional(),
});

const schema = Joi.object({
  id: fields.id.required(),
  name: fields.groupName.required(),
  description: fields.description.optional().allow('', null),
  sourceId: Joi.number().integer().optional(),
  status: fields.status.optional(),
  members: Joi.array().items(memberSchema).min(0).required().messages({
    'array.base': 'Members must be an array',
    'any.required': 'Members are required',
  }),
});

const UpdateProductGroupValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { clientData, loggedInId, permissions } = res.locals;
    const clientId = clientData.id;

    const { error, value } = validateSchema(schema, req.body);
    if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);
    req.body = value;

    const group = await AppDataSource.getRepository(ProductGroup).findOne({
      where: { id: value.id, clientId },
    });
    if (!group) {
      return sendResponse(res, false, CODE.NOT_FOUND, PG_MSG.NOT_FOUND);
    }

    // Default group metadata is frozen.
    if (group.isDefault === IS_DEFAULT.YES) {
      if (
        value.name !== group.name ||
        (value.description || '') !== (group.description || '') ||
        (value.status !== undefined && value.status !== group.status)
      ) {
        return sendResponse(
          res,
          false,
          CODE.UNAUTHORIZED,
          PG_MSG.CANNOT_MODIFY_DEFAULT,
        );
      }
    }

    // Record-level ownership: only creator can edit, unless caller has
    // `userManagement` (admin override).
    const isAdmin =
      Array.isArray(permissions) &&
      permissions.some(
        (p: any) =>
          p.value === 'userManagement' ||
          (p.subPermissions || []).some(
            (sp: any) => sp.value === 'userManagement',
          ),
      );
    if (group.createdBy && group.createdBy !== loggedInId && !isAdmin) {
      return sendResponse(res, false, CODE.UNAUTHORIZED, PG_MSG.NOT_OWNER);
    }

    // Duplicate-name guard against any OTHER group in the tenant.
    const dup = await AppDataSource.getRepository(ProductGroup).findOne({
      where: { id: Not(value.id), name: value.name, clientId },
    });
    if (dup) {
      return sendResponse(
        res,
        false,
        CODE.ALREADY_EXISTS,
        PG_MSG.ALREADY_EXISTS,
      );
    }

    // Members exist & belong to this tenant.
    if (value.members.length > 0) {
      const memberIds = value.members.map((m: { memberId: string }) => m.memberId);
      const found = await AppDataSource.getRepository(ProductBrowser).find({
        where: { id: In(memberIds), clientId },
        select: ['id'],
      });
      if (found.length !== memberIds.length) {
        return sendResponse(
          res,
          false,
          CODE.BAD_REQUEST,
          PG_MSG.MEMBERS_NOT_FOUND,
        );
      }
    }

    res.locals.productGroup = group;
    next();
  } catch (error) {
    Logger.error(`updateProductGroup validation: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default UpdateProductGroupValidation;
