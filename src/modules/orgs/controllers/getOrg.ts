/**
 * getOrg — returns an organisation record with live counts.
 *
 * All counts (users, groups, datasources, connections) live in the single
 * AppDataSource. Sensitive config fields (passwords, secret keys) are
 * explicitly excluded from the orgConfigData projection. SMTP/SES user-facing
 * values are decrypted before returning so the UI can display them.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  ORGANISATION as ORGANISATION_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { DatasourceConnection } from '../../../shared/db/entities/connections.entity';
import { DatasourceS } from '../../../shared/db/entities/datasourceS.entity';
import { Group } from '../../../shared/db/entities/group.entity';
import { User } from '../../../shared/db/entities/user.entity';
import { decryptForOrg } from '../../../shared/services/crypto.service';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const getOrg = async (req: Request, res: Response) => {
  const { id } = req.params;
  Logger.info(`Get Organisation request`);

  try {
    const { org } = res.locals;

    const encryptionAlgorithm = org.config?.encryptionAlgorithm || null;

    const orgConfigData = org.config
      ? {
          encryptionAlgorithm: org.config.encryptionAlgorithm,
          maxLoginAttempts: org.config.maxLoginAttempts,
          accountLockDurationHours: org.config.accountLockDurationHours,
          passwordHistoryLimit: org.config.passwordHistoryLimit,
          sessionInactivityTimeout: org.config.sessionInactivityTimeout,
          emailProvider: org.config.emailProvider,
          smtpHost: org.config.smtpHost,
          smtpPort: org.config.smtpPort,
          smtpUser: org.config.smtpUser
            ? decryptForOrg(org.config.smtpUser, org.config)
            : null,
          smtpFrom: org.config.smtpFrom,
          sesRegion: org.config.sesRegion,
          sesAccessKeyId: org.config.sesAccessKeyId
            ? decryptForOrg(org.config.sesAccessKeyId, org.config)
            : null,
          sesFrom: org.config.sesFrom,
          // Passwords/secrets NOT included — sensitive
        }
      : null;

    const [usersCount, groupsCount, databasesCount, connectionsCount] =
      await Promise.all([
        AppDataSource.getRepository(User).count({
          where: { organisationId: id },
        }),
        AppDataSource.getRepository(Group).count({
          where: { organisationId: id },
        }),
        AppDataSource.getRepository(DatasourceS).count({
          where: { organisationId: id },
        }),
        AppDataSource.getRepository(DatasourceConnection).count({
          where: { organisationId: id },
        }),
      ]);
    const adminsCount = 0;

    sendResponse(res, true, CODE.SUCCESS, ORGANISATION_MSG.FETCHED, {
      ...org,
      usersCount,
      adminsCount,
      groupsCount,
      databasesCount,
      connectionsCount,
      encryptionAlgorithm,
      orgConfig: orgConfigData,
    });
  } catch (error) {
    Logger.error(
      `Error while fetching Organisation: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default getOrg;
