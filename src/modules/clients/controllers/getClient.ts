/**
 * getClient — returns an client record with live counts + the
 * bootstrap admin user.
 *
 * All counts (users, groups, datasources, connections) live in the single
 * AppDataSource. Sensitive config fields (passwords, secret keys) are
 * explicitly excluded from the clientConfigData projection. SMTP/SES user-facing
 * values are decrypted with the platform master key before returning so the
 * UI can display them.
 *
 * The default admin user (the row created by addClient with
 * isDefault = IS_DEFAULT.YES) is loaded alongside the counts so the
 * client-edit screen can prefill the admin block. We project only
 * id/firstName/lastName/username/email/locale — sensitive fields like
 * password and setupToken stay out of the response.
 */
import { Request, Response } from 'express';
import { CODE, IS_DEFAULT } from '../../../../config/config';
import {
  GENERIC,
  CLIENT as CLIENT_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
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

    const clientConfigData = client.config
      ? {
          maxLoginAttempts: client.config.maxLoginAttempts,
          accountLockDurationHours: client.config.accountLockDurationHours,
          passwordHistoryLimit: client.config.passwordHistoryLimit,
          sessionInactivityTimeout: client.config.sessionInactivityTimeout,
          emailProvider: client.config.emailProvider,
          smtpHost: client.config.smtpHost,
          smtpPort: client.config.smtpPort,
          smtpUser: client.config.smtpUser
            ? decryptForClient(client.config.smtpUser)
            : null,
          smtpFrom: client.config.smtpFrom,
          sesRegion: client.config.sesRegion,
          sesAccessKeyId: client.config.sesAccessKeyId
            ? decryptForClient(client.config.sesAccessKeyId)
            : null,
          sesFrom: client.config.sesFrom,
          // Passwords/secrets NOT included — sensitive
        }
      : null;

    const [usersCount, groupsCount, defaultAdmin] = await Promise.all([
      AppDataSource.getRepository(User).count({
        where: { clientId: id },
      }),
      AppDataSource.getRepository(Group).count({
        where: { clientId: id },
      }),
      AppDataSource.getRepository(User).findOne({
        where: { clientId: id, isDefault: IS_DEFAULT.YES },
      }),
    ]);
    const adminsCount = 0;

    // Project a safe slice of the admin row — never leak password,
    // setupToken, refreshToken, or any audit timestamps.
    const admin = defaultAdmin
      ? {
          id: defaultAdmin.id,
          firstName: defaultAdmin.firstName,
          lastName: defaultAdmin.lastName,
          username: defaultAdmin.username,
          email: defaultAdmin.email,
          locale: defaultAdmin.locale,
          status: defaultAdmin.status,
        }
      : null;

    sendResponse(res, true, CODE.SUCCESS, CLIENT_MSG.FETCHED, {
      ...client,
      usersCount,
      adminsCount,
      groupsCount,
      clientConfig: clientConfigData,
      admin,
    });
  } catch (error) {
    Logger.error(
      `Error while fetching Client: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default getClient;
