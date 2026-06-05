/**
 * BulkDeleteProductGroupValidation — validates the batch, resolves all
 * groups in the caller's tenant, blocks default-group deletion, and
 * enforces ownership across the set.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { In } from 'typeorm';
import { CODE, IS_DEFAULT } from '../../../../config/config';
import {
  GENERIC,
  PRODUCT_GROUP as PG_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ProductGroup } from '../../../shared/db/entities/productGroup.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { fields } from '../../../shared/utility/joi.schemas';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const schema = Joi.object({
  ids: Joi.array().items(fields.id).min(1).required().messages({
    'array.min': 'At least one product group must be selected',
    'any.required': 'Product group ids are required',
  }),
  justification: fields.justification.optional(),
});

const BulkDeleteProductGroupValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { clientData, loggedInId, permissions } = res.locals;
    const clientId = clientData?.id as string;

    const { error, value } = validateSchema(schema, req.body);
    if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);
    req.body = value;

    const groups = await AppDataSource.getRepository(ProductGroup).find({
      where: { id: In(value.ids), clientId },
    });

    if (groups.length !== value.ids.length) {
      return sendResponse(res, false, CODE.NOT_FOUND, PG_MSG.NOT_FOUND);
    }

    if (groups.some((g: ProductGroup) => g.isDefault === IS_DEFAULT.YES)) {
      return sendResponse(
        res,
        false,
        CODE.UNAUTHORIZED,
        PG_MSG.CANNOT_MODIFY_DEFAULT,
      );
    }

    const isAdmin =
      Array.isArray(permissions) &&
      permissions.some(
        (p: any) =>
          p.value === 'userManagement' ||
          (p.subPermissions || []).some(
            (sp: any) => sp.value === 'userManagement',
          ),
      );
    if (
      !isAdmin &&
      groups.some(
        (g: ProductGroup) => g.createdBy && g.createdBy !== loggedInId,
      )
    ) {
      return sendResponse(res, false, CODE.UNAUTHORIZED, PG_MSG.NOT_OWNER);
    }

    res.locals.productGroups = groups;
    next();
  } catch (error) {
    Logger.error(
      `bulkDeleteProductGroup validation: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default BulkDeleteProductGroupValidation;
