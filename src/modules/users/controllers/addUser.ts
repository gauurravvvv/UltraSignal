/**
 * addUser — creates an org user, atomically assigns group memberships, and sends
 * a setup-link email so the user can set their own password.
 *
 * Users never receive an initial password from this endpoint — the setup-token
 * flow forces the user through a first-login password-set screen, which meets
 * the audit requirement that only the account owner ever knows their credential.
 *
 * The setup token is peppered-encrypted before storage so that a DB dump alone
 * cannot be used to construct valid setup links.
 *
 * The User save and UserGroupMapping inserts share a single transaction so the
 * user never lands in the DB without their intended group assignments.
 *
 * Email is fire-and-forget after the response is sent — a mail failure does not
 * roll back the DB write. The welcome email is decrypted from the org SMTP/SES
 * config at send time because credentials are stored encrypted at rest.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import {
  CODE,
  SETUP_TOKEN_EXPIRY_HOURS,
  STATUS,
} from '../../../../config/config';
import {
  GENERIC,
  USER as USER_MSG,
} from '../../../shared/constants/response.messages';
import { UserGroupMapping } from '../../../shared/db/entities/user-group-mapping.entity';
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
import { AppDataSource } from '../../../shared/db';

const addUser = async (req: Request, res: Response) => {
  Logger.info(`Add Org User request`);

  const {
    email,
    username,
    firstName,
    lastName,
    groupIds,
    locale = 'en',
  } = req.body;

  const { loggedInId, orgData } = res.locals;

  try {
    const user = new User();

    user.firstName = firstName;
    user.lastName = lastName;
    user.email = email;
    user.username = username;
    user.status = STATUS.ACTIVE;
    user.organisationName = orgData.name;
    user.organisationId = orgData.id;
    user.createdBy = loggedInId;
    user.locale = locale;

    const setupToken = generateSetupToken();
    user.setupToken = encryptForOrg(setupToken, orgData.config);
    user.setupTokenExpiresAt = new Date(
      Date.now() + SETUP_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        await manager.getRepository(User).save(user);

        if (groupIds?.length) {
          const mappings = groupIds.map((gId: string) => {
            const mapping = new UserGroupMapping();
            mapping.userId = user.id;
            mapping.groupId = gId;
            return mapping;
          });
          await manager.getRepository(UserGroupMapping).save(mappings);
        }
      },
    );

    const fullName = `${firstName || ''} ${lastName || ''}`.trim();

    const orgEmailConfig: OrgEmailConfig | undefined = orgData.config
      ?.emailProvider
      ? {
          emailProvider: orgData.config.emailProvider,
          smtpHost: orgData.config.smtpHost,
          smtpPort: orgData.config.smtpPort,
          smtpUser: orgData.config.smtpUser
            ? decryptForOrg(orgData.config.smtpUser, orgData.config)
            : null,
          smtpPassword: orgData.config.smtpPassword
            ? decryptForOrg(orgData.config.smtpPassword, orgData.config)
            : null,
          smtpFrom: orgData.config.smtpFrom,
          sesRegion: orgData.config.sesRegion,
          sesAccessKeyId: orgData.config.sesAccessKeyId
            ? decryptForOrg(orgData.config.sesAccessKeyId, orgData.config)
            : null,
          sesSecretAccessKey: orgData.config.sesSecretAccessKey
            ? decryptForOrg(orgData.config.sesSecretAccessKey, orgData.config)
            : null,
          sesFrom: orgData.config.sesFrom,
        }
      : undefined;

    welcomeEmailToUser(
      email,
      fullName,
      username,
      orgData.name,
      user.id,
      orgData.id,
      setupToken,
      orgEmailConfig,
      locale,
    );

    sendResponse(res, true, CODE.SUCCESS, USER_MSG.CREATED, user);
  } catch (error) {
    Logger.error(
      `Error while creating organisation user: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default addUser;
