/**
 * AddProductGroupValidation — validates payload, checks for duplicate names
 * within the tenant, and ensures every member id references a real
 * ProductBrowser row in the same tenant (count-mismatch guard prevents
 * cross-tenant probing).
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { In } from 'typeorm';
import { CODE } from '../../../../config/config';
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
  name: fields.groupName.required(),
  description: fields.description.optional().allow('', null),
  sourceId: Joi.number().integer().optional(),
  status: fields.status.optional(),
  members: Joi.array().items(memberSchema).min(0).optional().default([]),
});

const AddProductGroupValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { clientData } = res.locals;
    const clientId = clientData.id;

    const { error, value } = validateSchema(schema, req.body);
    if (error) {
      return sendResponse(res, false, CODE.BAD_REQUEST, error);
    }
    req.body = value;

    const existing = await AppDataSource.getRepository(ProductGroup).findOne({
      where: { name: value.name, clientId },
    });
    if (existing) {
      return sendResponse(
        res,
        false,
        CODE.ALREADY_EXISTS,
        PG_MSG.ALREADY_EXISTS,
      );
    }

    if (value.members?.length) {
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

    next();
  } catch (error) {
    Logger.error(`addProductGroup validation: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default AddProductGroupValidation;
