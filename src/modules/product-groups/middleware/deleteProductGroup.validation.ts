/**
 * DeleteProductGroupValidation — `DELETE /api/v1/product-groups/:id`.
 *
 * Same gate as update: 404 on missing / already-deleted, 403 on
 * system-scope / cross-tenant. Soft-delete via TypeORM's
 * `@DeleteDateColumn` (sets `deleted_on`).
 *
 * Loads the row into `res.locals.productGroup` so the controller is
 * pure write logic.
 */
import { NextFunction, Request, Response } from 'express';
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

const DeleteProductGroupValidation = async (
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

    const callerClientCode: string | null =
      res.locals.clientData?.clientCode ?? null;
    const isSystem = group.scope?.code === 'system';
    const ownsRow =
      !!callerClientCode && group.clientId === callerClientCode;
    if (isSystem || !ownsRow) {
      return sendResponse(res, false, CODE.FORBIDDEN, PG_MSG.IMMUTABLE);
    }

    res.locals.productGroup = group;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default DeleteProductGroupValidation;
