/**
 * getDataSource — returns the pre-loaded row (resolved + client-scoped
 * by middleware). The `type` relation is already joined, so the FE gets
 * `type: { id, sourceId, name, scope }` inline.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  DATA_SOURCE as DS_MSG,
  GENERIC,
} from '../../../shared/constants/response.messages';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const getDataSource = async (req: Request, res: Response) => {
  Logger.info('Get Data Source request');

  const { dataSource } = res.locals;

  try {
    sendResponse(res, true, CODE.SUCCESS, DS_MSG.FETCHED, dataSource);
  } catch (error) {
    Logger.error(`Error fetching data source: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default getDataSource;
