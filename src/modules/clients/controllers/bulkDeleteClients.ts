/**
 * bulkDeleteClients — atomically soft-deletes multiple clients in one transaction.
 *
 * Org configs are fetched in parallel before the transaction to minimise the time
 * spent inside the transaction. Config deletion is best-effort (guarded by null
 * check) — a missing config does not block the client soft-delete.
 *
 * Like single delete, external databases are NOT touched.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  CLIENT as CLIENT_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ClientConfig } from '../../../shared/db/entities/clientConfig.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const bulkDeleteClients = async (req: Request, res: Response) => {
  Logger.info(`Bulk delete Client request`);

  const { loggedInId, clients } = res.locals;

  try {
    const deletedIds: string[] = clients.map((o: any) => o.id);

    const clientConfigs = await Promise.all(
      clients.map((client: any) =>
        ClientConfig.findOne({ where: { id: client.configId } }),
      ),
    );

    await AppDataSource.transaction(async (manager: EntityManager) => {
      for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        const clientConfig = clientConfigs[i];
        client.deletedBy = loggedInId;
        if (clientConfig) clientConfig.deletedBy = loggedInId;
        await manager.save(client);
        if (clientConfig) {
          await manager.save(clientConfig);
          await manager.softRemove(clientConfig);
        }
        await manager.softRemove(client);
      }
    });

    sendResponse(res, true, CODE.SUCCESS, CLIENT_MSG.BULK_DELETED, {
      deletedCount: deletedIds.length,
      deletedIds,
    });
  } catch (error) {
    Logger.error(
      `Error while bulk deleting clients: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default bulkDeleteClients;
