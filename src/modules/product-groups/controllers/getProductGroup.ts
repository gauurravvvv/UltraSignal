/**
 * getProductGroup — returns one group with its members (each enriched with
 * the underlying ProductBrowser row for display).
 *
 * The group is loaded by middleware (`GetProductGroupValidation`) which
 * scopes it to `clientId` — a cross-tenant id silently returns 404.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  PRODUCT_GROUP as PG_MSG,
} from '../../../shared/constants/response.messages';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const getProductGroup = async (req: Request, res: Response) => {
  Logger.info(`Get Product Group request`);

  const { productGroup } = res.locals;

  try {
    sendResponse(res, true, CODE.SUCCESS, PG_MSG.FETCHED, productGroup);
  } catch (error) {
    Logger.error(`Error fetching product group: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default getProductGroup;
