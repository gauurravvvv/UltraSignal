/**
 * setPassword — completes first-time account setup from the welcome email link.
 *
 * The email link contains a 64-char hex setup token stored encrypted with the
 * org's DEK. Once the password is set the setup token is cleared so the link
 * becomes single-use. The password (also encrypted under the org DEK) and a
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
import { Organisation } from '../../../shared/db/entities/organisation.entity';
import { User } from '../../../shared/db/entities/user.entity';
import {
  decryptForOrg,
  encryptForOrg,
} from '../../../shared/services/crypto.service';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import { OrgEmailConfig } from '../../../shared/utility/mail';
import passwordSetSuccessEmail from '../../../shared/utility/mail/passwordSetSuccessEmail';
import { buildRequestContext } from '../../../shared/utility/mail/requestContext';
import { savePasswordHistoryShared } from '../../../shared/utility/passwordHistory';
import sendResponse from '../../../shared/utility/response';

const setPassword = async (req: Request, res: Response) => {
  Logger.info(`Set password request`);

  const { id, orgId, token, password } = req.body;

  try {
    const org = await Organisation.findOne({
      where: { id: orgId },
      relations: ['config'],
    });

    if (!org) {
      // Generic setup-token-invalid funnel: every pre-token-verified
      // failure (missing org, missing user, expired, mismatched) maps
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
      .andWhere('user.organisationId = :orgId', { orgId })
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

    const decryptedToken = decryptForOrg(user.setupToken, org.config);
    if (!timingSafeEqual(Buffer.from(token), Buffer.from(decryptedToken))) {
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        AUTH_MSG.SETUP_TOKEN_INVALID,
      );
    }

    user.password = encryptForOrg(password, org.config);
    user.setupToken = null;
    user.setupTokenExpiresAt = null;
    user.updatedBy = id;

    const passwordHistoryLimit = org.config?.passwordHistoryLimit || 5;

    await AppDataSource.transaction(async (manager: EntityManager) => {
      await manager.save(user);
      await savePasswordHistoryShared(
        manager,
        user.id,
        user.password!,
        passwordHistoryLimit,
      );
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

    passwordSetSuccessEmail(
      user.email,
      `${user.firstName} ${user.lastName}`.trim(),
      user.username,
      org.name,
      orgEmailConfig,
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
