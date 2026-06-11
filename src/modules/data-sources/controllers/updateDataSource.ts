/**
 * updateDataSource — applies the validated partial update. Fields not
 * present in the body keep their current value.
 *
 * Type is immutable (rejected by the validator). Password is treated as
 * optional: an empty / missing value means "keep the stored value",
 * a non-empty value gets encrypted and replaces it. This matches the
 * FE pattern of blanking the password field on edit so the user only
 * has to retype it when they actually want to change credentials.
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

interface UpdateDataSourceBody {
  name?: string;
  description?: string;
  host?: string;
  port?: number;
  dbname?: string;
  username?: string;
  password?: string | null;
  schema?: string;
  status?: number;
}

const updateDataSource = async (req: Request, res: Response) => {
  Logger.info('Update Data Source request');

  const {
    name,
    description,
    host,
    port,
    dbname,
    username,
    password,
    schema,
    status,
  } = req.body as UpdateDataSourceBody;
  const { loggedInId, dataSource } = res.locals;

  try {
    if (name !== undefined) dataSource.name = name;
    if (description !== undefined) dataSource.description = description;
    if (host !== undefined) dataSource.host = host;
    if (port !== undefined) dataSource.port = port;
    if (dbname !== undefined) dataSource.dbname = dbname;
    if (username !== undefined) dataSource.username = username;
    if (schema !== undefined) dataSource.schema = schema;
    if (status !== undefined) dataSource.status = status;

    // Password is special — only update if a real value was supplied.
    // Empty string / null are treated as "no change" so the FE can render
    // a blank password field on edit.
    if (password !== undefined && password !== null && password !== '') {
      dataSource.password = encryptForClient(password);
    }

    dataSource.updatedBy = loggedInId;

    const saved = await AppDataSource.getRepository(DataSource).save(dataSource);

    const { password: _omit, ...safe } = saved as DataSource & {
      password: string;
    };

    sendResponse(res, true, CODE.SUCCESS, DS_MSG.UPDATED, safe);
  } catch (error) {
    Logger.error(`Error updating data source: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default updateDataSource;
