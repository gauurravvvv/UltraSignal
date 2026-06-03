/**
 * changePassword — updates the logged-in user's password with reuse prevention.
 *
 * All users (system admin + client users) live in the single AppDataSource and use
 * the client-DEK encryption scheme. `refreshToken` is cleared on password change to
 * invalidate all existing sessions. Password history is enforced in a transaction
 * alongside the save so a failure rolls back the password change.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  AUTH as AUTH_MSG,
  GENERIC,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { Client } from '../../../shared/db/entities/client.entity';
import { User } from '../../../shared/db/entities/user.entity';
import {
  decryptForClient,
  encryptForClient,
} from '../../../shared/services/crypto.service';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import { ClientEmailConfig } from '../../../shared/utility/mail';
import passwordChangedSuccessEmail from '../../../shared/utility/mail/passwordChangedSuccessEmail';
import { buildRequestContext } from '../../../shared/utility/mail/requestContext';
import {
  isPasswordReusedShared,
  savePasswordHistoryShared,
} from '../../../shared/utility/passwordHistory';
import sendResponse from '../../../shared/utility/response';

const changePassword = async (req: Request, res: Response) => {
  Logger.info('Change password from profile request');

  const { newPassword } = req.body;
  const { loggedInId, clientId } = res.locals;

  try {
    const client = await Client.findOne({
      where: { id: clientId },
      relations: ['config'],
    });

    if (!client) {
      return sendResponse(res, false, CODE.NOT_FOUND, 'Client not found');
    }

    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: loggedInId, clientId },
    });

    if (!user) {
      return sendResponse(res, false, CODE.NOT_FOUND, 'User not found');
    }

    const isReused = await isPasswordReusedShared(
      AppDataSource.manager,
      user.id,
      newPassword,
      client.config,
      user.password ?? undefined,
    );
    if (isReused) {
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        AUTH_MSG.PASSWORD_REUSED,
      );
    }

    user.password = encryptForClient(newPassword, client.config);
    user.updatedBy = loggedInId;
    user.refreshToken = null;
    user.refreshTokenExpiresAt = null;

    await AppDataSource.transaction(async (manager: EntityManager) => {
      await manager.save(user);
      await savePasswordHistoryShared(manager, user.id, user.password!);
    });

    const clientEmailConfig: ClientEmailConfig | undefined = client.config?.emailProvider
      ? {
          emailProvider: client.config.emailProvider,
          smtpHost: client.config.smtpHost,
          smtpPort: client.config.smtpPort,
          smtpUser: client.config.smtpUser
            ? decryptForClient(client.config.smtpUser, client.config)
            : null,
          smtpPassword: client.config.smtpPassword
            ? decryptForClient(client.config.smtpPassword, client.config)
            : null,
          smtpFrom: client.config.smtpFrom,
          sesRegion: client.config.sesRegion,
          sesAccessKeyId: client.config.sesAccessKeyId
            ? decryptForClient(client.config.sesAccessKeyId, client.config)
            : null,
          sesSecretAccessKey: client.config.sesSecretAccessKey
            ? decryptForClient(client.config.sesSecretAccessKey, client.config)
            : null,
          sesFrom: client.config.sesFrom,
        }
      : undefined;

    passwordChangedSuccessEmail(
      user.email,
      `${user.firstName} ${user.lastName}`.trim(),
      user.username,
      client.name,
      clientEmailConfig,
      user.locale || 'en',
      buildRequestContext(req),
    );

    sendResponse(res, true, CODE.SUCCESS, 'Password updated successfully');
  } catch (error) {
    Logger.error(`Error changing password: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default changePassword;
