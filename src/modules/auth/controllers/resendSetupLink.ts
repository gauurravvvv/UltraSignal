/**
 * resendSetupLink — regenerates and re-sends the welcome / account-setup email.
 *
 * Called by an admin when a user's setup link has expired or was lost.
 * A new random setup token is generated and replaces the old one, so the
 * previous link becomes invalid immediately. Only users who haven't set a
 * password yet (user.password is null) can receive a new link — accounts
 * with a password already set must use the OTP password-reset flow.
 *
 * Setup tokens are encrypted with the client's DEK before storage.
 */
import { Request, Response } from 'express';
import {
  CODE,
  SETUP_TOKEN_EXPIRY_HOURS,
  STATUS,
} from '../../../../config/config';
import {
  AUTH as AUTH_MSG,
  GENERIC,
  CLIENT as CLIENT_MSG,
  USER as USER_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { Client } from '../../../shared/db/entities/client.entity';
import { User } from '../../../shared/db/entities/user.entity';
import {
  decryptForClient,
  encryptForClient,
} from '../../../shared/services/crypto.service';
import { generateSetupToken } from '../../../shared/utility/generateSetupToken';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import { ClientEmailConfig } from '../../../shared/utility/mail';
import welcomeEmailToUser from '../../../shared/utility/mail/welcomeEmailToUser';
import sendResponse from '../../../shared/utility/response';

const resendSetupLink = async (req: Request, res: Response) => {
  Logger.info(`Resend setup link request`);

  const { id, clientId } = req.body;

  try {
    const client = await Client.findOne({
      where: { id: clientId },
      relations: ['config'],
    });

    if (!client) {
      return sendResponse(
        res,
        false,
        CODE.NOT_FOUND,
        CLIENT_MSG.NOT_FOUND,
      );
    }

    const user = await AppDataSource.getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id })
      .andWhere('user.clientId = :clientId', { clientId })
      .getOne();

    if (!user) {
      return sendResponse(res, false, CODE.NOT_FOUND, USER_MSG.NOT_FOUND);
    }

    if (user.status === STATUS.INACTIVE) {
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        AUTH_MSG.ACCOUNT_INACTIVE,
      );
    }

    if (user.password) {
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        AUTH_MSG.PASSWORD_ALREADY_SET,
      );
    }

    const setupToken = generateSetupToken();
    user.setupToken = encryptForClient(setupToken, client.config);
    user.setupTokenExpiresAt = new Date(
      Date.now() + SETUP_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    await AppDataSource.getRepository(User).save(user);

    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();

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

    welcomeEmailToUser(
      user.email,
      fullName,
      user.username,
      client.name,
      user.id,
      client.id,
      setupToken,
      clientEmailConfig,
      user.locale || 'en',
    );

    return sendResponse(res, true, CODE.SUCCESS, AUTH_MSG.SETUP_LINK_RESENT);
  } catch (error) {
    Logger.error(`Error in resendSetupLink: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default resendSetupLink;
