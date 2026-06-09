/**
 * setPassword — completes first-time account setup from the welcome email link.
 *
 * The email link contains a 64-char hex setup token stored encrypted with the
 * client's DEK. Once the password is set the setup token is cleared so the link
 * becomes single-use. The password (also encrypted under the client DEK) and a
 * password-history row commit in a single transaction.
 *
 * timingSafeEqual is used for token comparison to prevent timing-based attacks.
 */
import { timingSafeEqual } from 'crypto';
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import { CODE, STATUS } from '../../../../config/config';
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
import passwordSetSuccessEmail from '../../../shared/utility/mail/passwordSetSuccessEmail';
import { buildRequestContext } from '../../../shared/utility/mail/requestContext';
import {
  isPasswordReused,
  savePasswordHistory,
} from '../../../shared/utility/passwordHistory';
import sendResponse from '../../../shared/utility/response';

const setPassword = async (req: Request, res: Response) => {
  Logger.info(`Set password request`);

  const { id, clientId, token, password } = req.body;

  try {
    const client = await Client.findOne({
      where: { id: clientId },
      relations: ['config'],
    });

    if (!client) {
      // Generic setup-token-invalid funnel: every pre-token-verified
      // failure (missing client, missing user, expired, mismatched) maps
      // to the same response so an attacker holding a setup-link URL
      // cannot infer state.
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        AUTH_MSG.SETUP_TOKEN_INVALID,
      );
    }

    const user = await AppDataSource.getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.setupToken')
      .addSelect('user.setupTokenExpiresAt')
      .addSelect('user.password')
      .where('user.id = :id', { id })
      .andWhere('user.clientId = :clientId', { clientId })
      .getOne();

    if (
      !user ||
      user.status === STATUS.INACTIVE ||
      user.password ||
      !user.setupToken
    ) {
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        AUTH_MSG.SETUP_TOKEN_INVALID,
      );
    }

    if (
      user.setupTokenExpiresAt &&
      new Date() > new Date(user.setupTokenExpiresAt)
    ) {
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        AUTH_MSG.SETUP_TOKEN_INVALID,
      );
    }

    const decryptedToken = decryptForClient(user.setupToken);
    if (!timingSafeEqual(Buffer.from(token), Buffer.from(decryptedToken))) {
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        AUTH_MSG.SETUP_TOKEN_INVALID,
      );
    }

    // Reuse check runs before encrypting the new value (the helper
    // also decrypts the current password to compare). The history
    // limit is per-client; default 5 from the entity definition.
    const historyLimit = client.config?.passwordHistoryLimit ?? 5;

    const newEncrypted = encryptForClient(password);

    try {
      await AppDataSource.transaction(async (manager: EntityManager) => {
        if (
          await isPasswordReused(
            manager,
            user.id,
            password,
            user.password,
            historyLimit,
          )
        ) {
          // Throwing inside the tx aborts the user.save below; caught
          // outside to convert into the FE-facing PASSWORD_REUSED error.
          throw new Error('PASSWORD_REUSED');
        }

        user.password = newEncrypted;
        user.setupToken = null;
        user.setupTokenExpiresAt = null;
        user.updatedBy = id;
        await manager.save(user);

        await savePasswordHistory(manager, user.id, newEncrypted, historyLimit);
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'PASSWORD_REUSED') {
        return sendResponse(
          res,
          false,
          CODE.BAD_REQUEST,
          AUTH_MSG.PASSWORD_REUSED,
        );
      }
      throw err;
    }

    const clientEmailConfig: ClientEmailConfig | undefined = client.config?.emailProvider
      ? {
          emailProvider: client.config.emailProvider,
          smtpHost: client.config.smtpHost,
          smtpPort: client.config.smtpPort,
          smtpUser: client.config.smtpUser
            ? decryptForClient(client.config.smtpUser)
            : null,
          smtpPassword: client.config.smtpPassword
            ? decryptForClient(client.config.smtpPassword)
            : null,
          smtpFrom: client.config.smtpFrom,
          sesRegion: client.config.sesRegion,
          sesAccessKeyId: client.config.sesAccessKeyId
            ? decryptForClient(client.config.sesAccessKeyId)
            : null,
          sesSecretAccessKey: client.config.sesSecretAccessKey
            ? decryptForClient(client.config.sesSecretAccessKey)
            : null,
          sesFrom: client.config.sesFrom,
        }
      : undefined;

    passwordSetSuccessEmail(
      user.email,
      `${user.firstName} ${user.lastName}`.trim(),
      user.username,
      client.name,
      clientEmailConfig,
      user.locale || 'en',
      buildRequestContext(req),
    );

    return sendResponse(res, true, CODE.SUCCESS, AUTH_MSG.PASSWORD_SET_SUCCESS);
  } catch (error) {
    Logger.error(`Error in setPassword: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default setPassword;
