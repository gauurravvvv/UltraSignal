/**
 * getProduct — returns one product browser row.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  PRODUCT as PRODUCT_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ProductBrowser } from '../../../shared/db/entities/products.entity';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const getProduct = async (req: Request, res: Response) => {
  Logger.info(`Get Product request`);

  const { id } = req.params;
  const { clientData } = res.locals;

  try {
    const product = await AppDataSource.getRepository(ProductBrowser).findOne({
      where: { id, clientId: clientData.id },
    });

    if (!product) {
      return sendResponse(res, false, CODE.NOT_FOUND, PRODUCT_MSG.NOT_FOUND);
    }

    sendResponse(res, true, CODE.SUCCESS, PRODUCT_MSG.FETCHED, product);
  } catch (error) {
    Logger.error(`Error fetching product: ${error}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default getProduct;
