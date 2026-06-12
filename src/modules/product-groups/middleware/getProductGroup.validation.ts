/**
 * GetProductGroupValidation — resolves the product group + its
 * (non-deleted) members and the scope relation, so the controller is
 * pure response shaping. Anything that's soft-deleted (`deletedOn IS
 * NOT NULL`) is treated as missing — 404.
 *
 * `:id` must parse as a positive integer.
 */
import { NextFunction, Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  PRODUCT_GROUP as PG_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ProductGroup } from '../../../shared/db/entities/product-group.entity';
import { ProductGroupMember } from '../../../shared/db/entities/product-group-member.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const GetProductGroupValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return sendResponse(res, false, CODE.BAD_REQUEST, PG_MSG.NOT_FOUND);
    }

    const group = await AppDataSource.getRepository(ProductGroup)
      .createQueryBuilder('pg')
      .leftJoinAndSelect('pg.scope', 'scope')
      .where('pg.product_group_id = :id', { id })
      .andWhere('pg.deleted_on IS NULL')
      .getOne();

    if (!group) {
      return sendResponse(res, false, CODE.NOT_FOUND, PG_MSG.NOT_FOUND);
    }

    /* Members fetched separately so pagination on list never trips
     * over the same join — keeps the two query shapes symmetric. */
    const members = await AppDataSource.getRepository(ProductGroupMember).find({
      where: { productGroupId: id },
      order: { productGroupMemberId: 'ASC' },
    });

    res.locals.productGroup = group;
    res.locals.productGroupMembers = members;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default GetProductGroupValidation;
