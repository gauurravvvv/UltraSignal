/**
 * resendSetupLink — regenerates and re-sends the welcome / account-setup email.
 *
 * Called by an admin when a user's setup link has expired or was lost.
 * A new random setup token is generated and replaces the old one, so the
 * previous link becomes invalid immediately. Only users who haven't set a
 * password yet (user.password is null) can receive a new link — accounts
 * with a password already set must use the OTP password-reset flow.
 *
 * Setup tokens are encrypted with the org's DEK before storage.
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
  ORGANISATION as ORGANISATION_MSG,
  USER as USER_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { Organisation } from '../../../shared/db/entities/organisation.entity';
import { User } from '../../../shared/db/entities/user.entity';
import {
  decryptForOrg,
  encryptForOrg,
} from '../../../shared/services/crypto.service';
import { generateSetupToken } from '../../../shared/utility/generateSetupToken';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import { OrgEmailConfig } from '../../../shared/utility/mail';
import welcomeEmailToUser from '../../../shared/utility/mail/welcomeEmailToUser';
import sendResponse from '../../../shared/utility/response';

const resendSetupLink = async (req: Request, res: Response) => {
  Logger.info(`Resend setup link request`);

  const { id, orgId } = req.body;

  try {
    const org = await Organisation.findOne({
      where: { id: orgId },
      relations: ['config'],
    });

    if (!org) {
      return sendResponse(
        res,
        false,
        CODE.NOT_FOUND,
        ORGANISATION_MSG.NOT_FOUND,
      );
    }

    const user = await AppDataSource.getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id })
      .andWhere('user.organisationId = :orgId', { orgId })
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
    user.setupToken = encryptForOrg(setupToken, org.config);
    user.setupTokenExpiresAt = new Date(
      Date.now() + SETUP_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    await AppDataSource.getRepository(User).save(user);

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

    welcomeEmailToUser(
      user.email,
      fullName,
      user.username,
      org.name,
      user.id,
      org.id,
      setupToken,
      orgEmailConfig,
      user.locale || 'en',
    );

    return sendResponse(res, true, CODE.SUCCESS, AUTH_MSG.SETUP_LINK_RESENT);
  } catch (error) {
    Logger.error(`Error in resendSetupLink: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default resendSetupLink;
