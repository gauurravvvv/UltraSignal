/**
 * deleteDataSource — soft-deletes the data source row.
 *
 * Two-step transaction (set `deletedBy`, then `softDelete`) mirrors the
 * roles/groups delete pattern so the audit field is persisted atomically
 * with the soft-delete timestamp.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
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

const deleteDataSource = async (req: Request, res: Response) => {
  Logger.info('Delete Data Source request');

  const { loggedInId, dataSource } = res.locals;

  try {
    await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        dataSource.deletedBy = loggedInId;
        await manager.getRepository(DataSource).save(dataSource);
        await manager.getRepository(DataSource).softDelete(dataSource.id);
      },
    );

    sendResponse(res, true, CODE.SUCCESS, DS_MSG.DELETED);
  } catch (error) {
    Logger.error(`Error deleting data source: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default deleteDataSource;
