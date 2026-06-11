/**
 * addDataSource — creates a new data source for the caller's client.
 *
 * Body shape (already validated):
 *   { name: string, description?: string, typeId: string (uuid) }
 *
 * Type existence + name uniqueness are checked in middleware.
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

const addDataSource = async (req: Request, res: Response) => {
  Logger.info('Add Data Source request');

  const { name, description, typeId } = req.body as {
    name: string;
    description?: string;
    typeId: string;
  };
  const { loggedInId, clientData } = res.locals;

  try {
    const row = new DataSource();
    row.name = name;
    row.description = description || undefined;
    row.typeId = typeId;
    row.clientId = clientData.id;
    row.clientName = clientData.name;
    row.status = 1;
    row.createdBy = loggedInId;

    const saved = await AppDataSource.getRepository(DataSource).save(row);

    sendResponse(res, true, CODE.SUCCESS, DS_MSG.CREATED, saved);
  } catch (error) {
    Logger.error(`Error creating data source: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default addDataSource;
