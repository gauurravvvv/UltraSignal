/**
 * addDataSource — creates a new data source for the caller's client.
 *
 * Body shape (already validated):
 *   { name, description?, typeId, host, port, dbname,
 *     username, password, schema }
 *
 * Type existence + name uniqueness are checked in middleware. Password
 * is encrypted with the platform master key before storage; the column
 * itself is `select: false`, so it never returns from default reads.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  DATA_SOURCE as DS_MSG,
  GENERIC,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { DataSource } from '../../../shared/db/entities/data-source.entity';
import { encryptForClient } from '../../../shared/services/crypto.service';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

interface AddDataSourceBody {
  name: string;
  description?: string;
  typeId: string;
  host: string;
  port: number;
  dbname: string;
  username: string;
  password: string;
  schema: string;
}

const addDataSource = async (req: Request, res: Response) => {
  Logger.info('Add Data Source request');

  const {
    name,
    description,
    typeId,
    host,
    port,
    dbname,
    username,
    password,
    schema,
  } = req.body as AddDataSourceBody;
  const { loggedInId, clientData } = res.locals;

  try {
    const row = new DataSource();
    row.name = name;
    row.description = description || undefined;
    row.typeId = typeId;
    row.host = host;
    row.port = port;
    row.dbname = dbname;
    row.username = username;
    row.password = encryptForClient(password);
    row.schema = schema;
    row.clientId = clientData.id;
    row.clientName = clientData.name;
    row.status = 1;
    row.createdBy = loggedInId;

    const saved = await AppDataSource.getRepository(DataSource).save(row);

    // Strip the encrypted password from the response payload — the
    // entity object still carries it in memory after save(), even
    // though the column is `select: false` for reads.
    const { password: _omit, ...safe } = saved as DataSource & { password: string };

    sendResponse(res, true, CODE.SUCCESS, DS_MSG.CREATED, safe);
  } catch (error) {
    Logger.error(`Error creating data source: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default addDataSource;
