/**
 * resetPassword — sets a new password after OTP verification.
 *
 * The user must have requested an OTP via /auth/generateOTP first.
 * After a successful reset:
 *  - The new password is saved (encrypted under the org DEK).
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
import { Organisation } from '../../../shared/db/entities/organisation.entity';
import { User } from '../../../shared/db/entities/user.entity';
import {
  decryptForOrg,
  encryptForOrg,
} from '../../../shared/services/crypto.service';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import { OrgEmailConfig } from '../../../shared/utility/mail';
import passwordResetSuccessEmail from '../../../shared/utility/mail/passwordResetSuccessEmail';
import { buildRequestContext } from '../../../shared/utility/mail/requestContext';
import {
  isPasswordReusedShared,
  savePasswordHistoryShared,
} from '../../../shared/utility/passwordHistory';
import sendResponse from '../../../shared/utility/response';

const resetPassword = async (req: Request, res: Response) => {
  Logger.info(`Reset password request`);

  const { id, orgId, otp, password } = req.body;

  try {
    const org = await Organisation.findOne({
      where: { id: orgId },
      relations: ['config'],
    });

    if (!org) {
      // Generic OTP-invalid funnel — every pre-OTP-verified failure
      // returns the same response so an attacker cannot probe orgs /
      // users / lock state via this endpoint.
      sendResponse(res, false, CODE.BAD_REQUEST, AUTH_MSG.OTP_INVALID);
      return;
    }

    const user = await AppDataSource.getRepository(User).findOne({
      where: { organisationId: orgId, id },
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
    const passwordHistoryLimit = org.config?.passwordHistoryLimit || 5;
    const isReused = await isPasswordReusedShared(
      AppDataSource.manager,
      user.id,
      password,
      org.config,
      user.password,
      passwordHistoryLimit,
    );
    if (isReused) {
      return sendResponse(res, false, CODE.BAD_REQUEST, AUTH_MSG.PASSWORD_REUSED);
    }

    user.password = encryptForOrg(password, org.config);
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

    const orgEmailConfig: OrgEmailConfig | undefined = org.config?.emailProvider
      ? {
          emailProvider: org.config.emailProvider,
          smtpHost: org.config.smtpHost,
          smtpPort: org.config.smtpPort,
          smtpUser: org.config.smtpUser
            ? decryptForOrg(org.config.smtpUser, org.config)
            : null,
          smtpPassword: org.config.smtpPassword
            ? decryptForOrg(org.config.smtpPassword, org.config)
            : null,
          smtpFrom: org.config.smtpFrom,
          sesRegion: org.config.sesRegion,
          sesAccessKeyId: org.config.sesAccessKeyId
            ? decryptForOrg(org.config.sesAccessKeyId, org.config)
            : null,
          sesSecretAccessKey: org.config.sesSecretAccessKey
            ? decryptForOrg(org.config.sesSecretAccessKey, org.config)
            : null,
          sesFrom: org.config.sesFrom,
        }
      : undefined;

    passwordResetSuccessEmail(
      user.email,
      fullName,
      user.username,
      org.name,
      orgEmailConfig,
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
