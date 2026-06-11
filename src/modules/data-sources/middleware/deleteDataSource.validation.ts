/**
 * DeleteDataSourceValidation — verifies the row exists and is scoped to
 * the caller's client. Pre-loads it into `res.locals.dataSource` so the
 * controller doesn't repeat the lookup.
 */
import { NextFunction, Request, Response } from 'express';
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

const DeleteDataSourceValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const clientId = res.locals.clientData?.id as string;

    if (!id) {
      return sendResponse(res, false, CODE.BAD_REQUEST, DS_MSG.ID_REQUIRED);
    }

    const dataSource = await AppDataSource.getRepository(DataSource).findOne({
      where: { id, clientId },
    });

    if (!dataSource) {
      return sendResponse(res, false, CODE.NOT_FOUND, DS_MSG.NOT_FOUND);
    }

    res.locals.dataSource = dataSource;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default DeleteDataSourceValidation;
