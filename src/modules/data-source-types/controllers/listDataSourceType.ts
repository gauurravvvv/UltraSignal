/**
 * listDataSourceType — returns the catalog of upstream system types
 * (AEMS, UAN, ...) used to populate the type dropdown on the
 * Data Source creation / edit screen.
 *
 * Reference data only — no per-client filtering, no pagination. Returns
 * active types (status = 1) ordered by `sequence`.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  DATA_SOURCE_TYPE as DST_MSG,
  GENERIC,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { DataSourceType } from '../../../shared/db/entities/data-source-type.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const listDataSourceType = async (req: Request, res: Response) => {
  Logger.info('List Data Source Types request');

  try {
    const types = await AppDataSource.getRepository(DataSourceType).find({
      where: { status: 1 },
      order: { sourceId: 'ASC' },
    });

    sendResponse(res, true, CODE.SUCCESS, DST_MSG.LIST_FETCHED, {
      count: types.length,
      types,
    });
  } catch (error) {
    Logger.error(
      `Error while listing data source types: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default listDataSourceType;
