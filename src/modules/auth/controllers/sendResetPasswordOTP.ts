/**
 * generateOTP — sends a time-limited one-time password to the user's email
 * to begin the password reset flow.
 *
 * Rate-limited at the DB level: if an unexpired OTP already exists, the
 * endpoint returns a 400 with the remaining wait time so the UI can show
 * a countdown without allowing OTP spam.
 *
 * The OTP is stored as plain text in the DB (it's short-lived and low
 * entropy by design — the time-limit and single-use nature provide the
 * security, not secrecy of the stored value).
 */
import { Request, Response } from 'express';
import { CODE, RESET_PASS_EXPIRE_TIME } from '../../../../config/config';
import {
  AUTH as AUTH_MSG,
  GENERIC,
  CLIENT as CLIENT_MSG,
  USER as USER_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { Client } from '../../../shared/db/entities/client.entity';
import { User } from '../../../shared/db/entities/user.entity';
import { decryptForClient } from '../../../shared/services/crypto.service';
import { GENERATE_OTP } from '../../../shared/utility/generateOTP';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import { ClientEmailConfig } from '../../../shared/utility/mail';
import { buildRequestContext } from '../../../shared/utility/mail/requestContext';
import resetPassEmail from '../../../shared/utility/mail/resetPassEmail';
import sendResponse from '../../../shared/utility/response';

const generateOTP = async (req: Request, res: Response) => {
  Logger.info(`OTP request`);

  const { client: clientNameInput, username, email } = req.body;

  try {
    const client = await Client.findOne({
      where: { name: clientNameInput },
      relations: ['config'],
    });

    if (!client) {
      sendResponse(res, false, CODE.NOT_FOUND, CLIENT_MSG.NOT_FOUND);
      return;
    }

    const user = await AppDataSource.getRepository(User).findOne({
      where: { clientName: clientNameInput, username, email },
    });

    if (!user) {
      sendResponse(res, false, CODE.NOT_FOUND, USER_MSG.NOT_FOUND);
      return;
    }

    if (!user.password) {
      sendResponse(res, false, CODE.FORBIDDEN, AUTH_MSG.PASSWORD_NOT_SET);
      return;
    }

    if (user.accountLockedAt) {
      return sendResponse(res, false, CODE.FORBIDDEN, AUTH_MSG.ACCOUNT_LOCKED);
    }

    if (
      user.otp &&
      user.otpExpiresAt &&
      new Date() < new Date(user.otpExpiresAt)
    ) {
      const remainingMs = new Date(user.otpExpiresAt).getTime() - Date.now();
      const remainingMin = Math.floor(remainingMs / 60000);
      const remainingSec = Math.ceil((remainingMs % 60000) / 1000);
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        `OTP already sent. You can request again in ${remainingMin}m ${remainingSec}s`,
        { otpExpiresAt: user.otpExpiresAt },
      );
    }

    user.otp = GENERATE_OTP();
    user.otpExpiresAt = new Date(
      Date.now() + RESET_PASS_EXPIRE_TIME * 60 * 1000,
    );
    await AppDataSource.getRepository(User).save(user);

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

    const emailSent = await resetPassEmail(
      user.email,
      String(user.otp),
      user.id,
      client.id,
      clientEmailConfig,
      user.locale || res.locals.locale || 'en',
      buildRequestContext(req),
      client.name,
    );
    if (!emailSent) {
      Logger.warn(`OTP generated but email delivery failed for ${user.email}`);
    }

    sendResponse(res, true, CODE.SUCCESS, AUTH_MSG.OTP_SENT, {
      otpExpiresAt: user.otpExpiresAt,
    });
  } catch (error) {
    Logger.error(`Error in generateOTP: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default generateOTP;
