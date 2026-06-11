/**
 * updateDataSource — applies the validated partial update. Fields not
 * present in the body keep their current value.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  DATA_SOURCE as DS_MSG,
  GENERIC,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { DataSource } from '../../../shared/db/entities/data-source.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const updateDataSource = async (req: Request, res: Response) => {
  Logger.info('Update Data Source request');

  const { name, description, typeId, status } = req.body as {
    name?: string;
    description?: string;
    typeId?: string;
    status?: number;
  };
  const { loggedInId, dataSource } = res.locals;

  try {
    if (name !== undefined) dataSource.name = name;
    if (description !== undefined) dataSource.description = description;
    if (typeId !== undefined) dataSource.typeId = typeId;
    if (status !== undefined) dataSource.status = status;
    dataSource.updatedBy = loggedInId;

    const saved = await AppDataSource.getRepository(DataSource).save(dataSource);

    sendResponse(res, true, CODE.SUCCESS, DS_MSG.UPDATED, saved);
  } catch (error) {
    Logger.error(`Error updating data source: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default updateDataSource;
