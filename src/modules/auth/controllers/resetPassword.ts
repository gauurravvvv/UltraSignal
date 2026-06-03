/**
 * resetPassword — sets a new password after OTP verification.
 *
 * The user must have requested an OTP via /auth/generateOTP first.
 * After a successful reset:
 *  - The new password is saved (encrypted under the client DEK).
 *  - Both OTP fields and the refresh token are cleared, forcing a new login.
 *  - Password history is updated so the same password can't be reused.
 *  - A confirmation email is sent to the user (fire-and-forget).
 */
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
import passwordResetSuccessEmail from '../../../shared/utility/mail/passwordResetSuccessEmail';
import { buildRequestContext } from '../../../shared/utility/mail/requestContext';
import {
  isPasswordReusedShared,
  savePasswordHistoryShared,
} from '../../../shared/utility/passwordHistory';
import sendResponse from '../../../shared/utility/response';

const resetPassword = async (req: Request, res: Response) => {
  Logger.info(`Reset password request`);

  const { id, clientId, otp, password } = req.body;

  try {
    const client = await Client.findOne({
      where: { id: clientId },
      relations: ['config'],
    });

    if (!client) {
      // Generic OTP-invalid funnel — every pre-OTP-verified failure
      // returns the same response so an attacker cannot probe clients /
      // users / lock state via this endpoint.
      sendResponse(res, false, CODE.BAD_REQUEST, AUTH_MSG.OTP_INVALID);
      return;
    }

    const user = await AppDataSource.getRepository(User).findOne({
      where: { clientId: clientId, id },
    });

    if (
      !user ||
      user.status === STATUS.INACTIVE ||
      user.accountLockedAt ||
      !user.password ||
      !user.otp
    ) {
      sendResponse(res, false, CODE.BAD_REQUEST, AUTH_MSG.OTP_INVALID);
      return;
    }

    if (user.otpExpiresAt && new Date() > new Date(user.otpExpiresAt)) {
      user.otp = null;
      user.otpExpiresAt = null;
      await AppDataSource.transaction(async (manager: EntityManager) => {
        await manager.save(user);
      });
      sendResponse(res, false, CODE.BAD_REQUEST, AUTH_MSG.OTP_INVALID);
      return;
    }

    if (otp !== user.otp) {
      sendResponse(res, false, CODE.BAD_REQUEST, AUTH_MSG.OTP_INVALID);
      return;
    }

    // Check password history. Post-OTP, PASSWORD_REUSED is intentionally
    // distinct from OTP_INVALID — the OTP did succeed, the new password is
    // simply not acceptable.
    const passwordHistoryLimit = client.config?.passwordHistoryLimit || 5;
    const isReused = await isPasswordReusedShared(
      AppDataSource.manager,
      user.id,
      password,
      client.config,
      user.password,
      passwordHistoryLimit,
    );
    if (isReused) {
      return sendResponse(res, false, CODE.BAD_REQUEST, AUTH_MSG.PASSWORD_REUSED);
    }

    user.password = encryptForClient(password, client.config);
    user.otp = null;
    user.otpExpiresAt = null;
    user.updatedBy = id;
    user.refreshToken = null;
    user.refreshTokenExpiresAt = null;

    await AppDataSource.transaction(async (manager: EntityManager) => {
      await manager.save(user);
      await savePasswordHistoryShared(
        manager,
        user.id,
        user.password!,
        passwordHistoryLimit,
      );
    });

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

    passwordResetSuccessEmail(
      user.email,
      fullName,
      user.username,
      client.name,
      clientEmailConfig,
      user.locale || res.locals.locale || 'en',
      buildRequestContext(req),
    );

    return sendResponse(res, true, CODE.SUCCESS, AUTH_MSG.PASSWORD_CHANGED);
  } catch (error) {
    Logger.error(`Error in resetPassword: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default resetPassword;
