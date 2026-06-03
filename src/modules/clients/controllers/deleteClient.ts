/**
 * deleteClient — soft-deletes an client and its config in one atomic transaction.
 *
 * Both the Client and ClientConfig rows are soft-deleted together.
 * The client's external database is NOT touched — data is preserved for potential
 * recovery and the system admin must clean up the external DB manually if needed.
 *
 * deletedBy is stamped on both records before the soft-delete so the audit trail
 * records who triggered the deletion.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  CLIENT as CLIENT_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { Client } from '../../../shared/db/entities/client.entity';
import { ClientConfig } from '../../../shared/db/entities/clientConfig.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const deleteClient = async (req: Request, res: Response) => {
  try {
    Logger.info(`Delete Client request`);

    const { loggedInId, client } = res.locals;

    const clientConfig = await ClientConfig.findOne({
      where: { id: client.configId },
    });

    if (!clientConfig) {
      return sendResponse(
        res,
        false,
        CODE.NOT_FOUND,
        CLIENT_MSG.NOT_FOUND,
      );
    }

    await AppDataSource.transaction(async manager => {
      client.deletedBy = loggedInId;
      clientConfig.deletedBy = loggedInId;
      await manager.save(Client, client);
      await manager.save(ClientConfig, clientConfig);
      await manager.softRemove(Client, client);
      await manager.softRemove(ClientConfig, clientConfig);
    });

    sendResponse(res, true, CODE.SUCCESS, CLIENT_MSG.DELETED);
  } catch (error) {
    Logger.error(
      `Error while deleting client: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default deleteClient;
