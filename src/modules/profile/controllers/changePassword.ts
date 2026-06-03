/**
 * changePassword — updates the logged-in user's password with reuse prevention.
 *
 * All users (system admin + org users) live in the single AppDataSource and use
 * the org-DEK encryption scheme. `refreshToken` is cleared on password change to
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
import { Organisation } from '../../../shared/db/entities/organisation.entity';
import { User } from '../../../shared/db/entities/user.entity';
import {
  decryptForOrg,
  encryptForOrg,
} from '../../../shared/services/crypto.service';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import { OrgEmailConfig } from '../../../shared/utility/mail';
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
  const { loggedInId, organisationId } = res.locals;

  try {
    const org = await Organisation.findOne({
      where: { id: organisationId },
      relations: ['config'],
    });

    if (!org) {
      return sendResponse(res, false, CODE.NOT_FOUND, 'Organisation not found');
    }

    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: loggedInId, organisationId },
    });

    if (!user) {
      return sendResponse(res, false, CODE.NOT_FOUND, 'User not found');
    }

    const isReused = await isPasswordReusedShared(
      AppDataSource.manager,
      user.id,
      newPassword,
      org.config,
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

    user.password = encryptForOrg(newPassword, org.config);
    user.updatedBy = loggedInId;
    user.refreshToken = null;
    user.refreshTokenExpiresAt = null;

    await AppDataSource.transaction(async (manager: EntityManager) => {
      await manager.save(user);
      await savePasswordHistoryShared(manager, user.id, user.password!);
    });

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

    passwordChangedSuccessEmail(
      user.email,
      `${user.firstName} ${user.lastName}`.trim(),
      user.username,
      org.name,
      orgEmailConfig,
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
