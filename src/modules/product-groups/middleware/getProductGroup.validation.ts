/**
 * GetProductGroupValidation — loads the group with member rows + their
 * underlying ProductBrowser data for display.
 *
 * Cross-tenant 404: if the id belongs to another client the where clause
 * just doesn't match — the caller can't distinguish "doesn't exist" from
 * "not yours".
 */
import { NextFunction, Request, Response } from 'express';
import { CODE, VALIDATION_MESSAGES } from '../../../../config/config';
import {
  CLIENT,
  PRODUCT_GROUP as PG_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ProductGroup } from '../../../shared/db/entities/productGroup.entity';
import sendResponse from '../../../shared/utility/response';

const GetProductGroupValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { id } = req.params;
  const { clientData } = res.locals;
  const clientId = clientData?.id as string;

  if (!id) {
    return sendResponse(
      res,
      false,
      CODE.BAD_REQUEST,
      VALIDATION_MESSAGES.ID.REQUIRED + ' for product group',
    );
  }

  try {
    const group = await AppDataSource.getRepository(ProductGroup)
      .createQueryBuilder('pg')
      .leftJoinAndSelect('pg.members', 'm', 'm.deletedOn IS NULL')
      .leftJoinAndSelect('m.member', 'browser')
      .where('pg.id = :id', { id })
      .andWhere('pg.clientId = :clientId', { clientId })
      .getOne();

    if (!group) {
      return sendResponse(res, false, CODE.NOT_FOUND, PG_MSG.NOT_FOUND);
    }

    res.locals.productGroup = group;
  } catch {
    return sendResponse(res, false, CODE.BAD_REQUEST, CLIENT.INVALID_ID);
  }

  next();
};

export default GetProductGroupValidation;
