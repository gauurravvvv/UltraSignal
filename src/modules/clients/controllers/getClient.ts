/**
 * getClient — returns an client record with live counts.
 *
 * All counts (users, groups, datasources, connections) live in the single
 * AppDataSource. Sensitive config fields (passwords, secret keys) are
 * explicitly excluded from the clientConfigData projection. SMTP/SES user-facing
 * values are decrypted before returning so the UI can display them.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  CLIENT as CLIENT_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { DatasourceConnection } from '../../../shared/db/entities/connections.entity';
import { DatasourceS } from '../../../shared/db/entities/datasourceS.entity';
import { Group } from '../../../shared/db/entities/group.entity';
import { User } from '../../../shared/db/entities/user.entity';
import { decryptForClient } from '../../../shared/services/crypto.service';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const getClient = async (req: Request, res: Response) => {
  const { id } = req.params;
  Logger.info(`Get Client request`);

  try {
    const { client } = res.locals;

    const encryptionAlgorithm = client.config?.encryptionAlgorithm || null;

    const clientConfigData = client.config
      ? {
          encryptionAlgorithm: client.config.encryptionAlgorithm,
          maxLoginAttempts: client.config.maxLoginAttempts,
          accountLockDurationHours: client.config.accountLockDurationHours,
          passwordHistoryLimit: client.config.passwordHistoryLimit,
          sessionInactivityTimeout: client.config.sessionInactivityTimeout,
          emailProvider: client.config.emailProvider,
          smtpHost: client.config.smtpHost,
          smtpPort: client.config.smtpPort,
          smtpUser: client.config.smtpUser
            ? decryptForClient(client.config.smtpUser, client.config)
            : null,
          smtpFrom: client.config.smtpFrom,
          sesRegion: client.config.sesRegion,
          sesAccessKeyId: client.config.sesAccessKeyId
            ? decryptForClient(client.config.sesAccessKeyId, client.config)
            : null,
          sesFrom: client.config.sesFrom,
          // Passwords/secrets NOT included — sensitive
        }
      : null;

    const [usersCount, groupsCount, databasesCount, connectionsCount] =
      await Promise.all([
        AppDataSource.getRepository(User).count({
          where: { clientId: id },
        }),
        AppDataSource.getRepository(Group).count({
          where: { clientId: id },
        }),
        AppDataSource.getRepository(DatasourceS).count({
          where: { clientId: id },
        }),
        AppDataSource.getRepository(DatasourceConnection).count({
          where: { clientId: id },
        }),
      ]);
    const adminsCount = 0;

    sendResponse(res, true, CODE.SUCCESS, CLIENT_MSG.FETCHED, {
      ...client,
      usersCount,
      adminsCount,
      groupsCount,
      databasesCount,
      connectionsCount,
      encryptionAlgorithm,
      clientConfig: clientConfigData,
    });
  } catch (error) {
    Logger.error(
      `Error while fetching Client: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default getClient;
