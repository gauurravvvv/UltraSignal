/**
 * addClient — provisions a new tenant client inside the single AppDataSource.
 *
 * All rows commit in a single transaction:
 *  - ClientConfig (with envelope-encrypted DEK, security policy, email config)
 *  - Client
 *  - Two default per-client roles (Administrator, Member)
 *  - Two default groups (Administrators, Members) bound to the roles
 *  - The bootstrap client admin User
 *  - The UserGroupMapping joining admin user to Administrators group
 *
 * Email credentials (SMTP user/password, SES keys) are stored encrypted with the
 * client's own DEK so they cannot be decrypted without that key.
 *
 * The welcome email to the client admin is sent after the transaction commits so a
 * mail-delivery failure does not roll back the client creation.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import {
  CODE,
  IS_DEFAULT,
  MASTER_ADMIN,
  SETUP_TOKEN_EXPIRY_HOURS,
  STATUS,
} from '../../../../config/config';
import { CLIENT_ADMIN_PERMISSIONS } from '../../../shared/constants/permissions/clientAdmin.permission';

import {
  GENERIC,
  CLIENT as CLIENT_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { Group } from '../../../shared/db/entities/group.entity';
import { Client } from '../../../shared/db/entities/client.entity';
import { ClientConfig } from '../../../shared/db/entities/clientConfig.entity';
import { Role } from '../../../shared/db/entities/role.entity';
import { UserGroupMapping } from '../../../shared/db/entities/user-group-mapping.entity';
import { User } from '../../../shared/db/entities/user.entity';
import {
  decryptForClient,
  encryptForClient,
  generateDek,
  wrapDek,
} from '../../../shared/services/crypto.service';
import { generateSetupToken } from '../../../shared/utility/generateSetupToken';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import { ClientEmailConfig } from '../../../shared/utility/mail';
import welcomeEmailToUser from '../../../shared/utility/mail/welcomeEmailToUser';
import sendResponse from '../../../shared/utility/response';
import { CLIENT_USER_PERMISSIONS } from '../../../../src/shared/constants/permissions/user.permission';

const addClient = async (req: Request, res: Response) => {
  Logger.info(`Add Client request`);

  const {
    name,
    description,
    adminEmail,
    adminLocale = 'en',
    maxLoginAttempts,
    accountLockDurationHours,
    passwordHistoryLimit,
    sessionInactivityTimeout,
    emailProvider,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPassword,
    smtpFrom,
    sesRegion,
    sesAccessKeyId,
    sesSecretAccessKey,
    sesFrom,
  } = req.body;
  const { loggedInId } = res.locals;

  try {
    // Generate this client's data-encryption key (DEK) and wrap it under
    // the platform master key. The raw DEK never touches the DB — only
    // the wrapped form. Scrub the raw buffer the moment wrapping succeeds.
    const dek = generateDek();
    let encryptedDek: string;
    try {
      encryptedDek = wrapDek(dek);
    } finally {
      dek.fill(0);
    }

    const result = await AppDataSource.transaction(
      async (manager: EntityManager) => {
        const clientConfig = new ClientConfig();
        clientConfig.createdBy = loggedInId;
        clientConfig.encryptedDek = encryptedDek;
        // Legacy columns intentionally left null on new clients — the
        // migrate-on-read helper treats `encryptedDek != null` as
        // "already on the new scheme; skip migration".
        clientConfig.pepperKey = null;
        clientConfig.encryptionAlgorithm = null;

        if (maxLoginAttempts !== undefined)
          clientConfig.maxLoginAttempts = maxLoginAttempts;
        if (accountLockDurationHours !== undefined)
          clientConfig.accountLockDurationHours = accountLockDurationHours;
        if (passwordHistoryLimit !== undefined)
          clientConfig.passwordHistoryLimit = passwordHistoryLimit;
        if (sessionInactivityTimeout !== undefined)
          clientConfig.sessionInactivityTimeout = sessionInactivityTimeout;

        if (emailProvider) {
          clientConfig.emailProvider = emailProvider;
          if (emailProvider === 'SMTP') {
            clientConfig.smtpHost = smtpHost || null;
            clientConfig.smtpPort = smtpPort || null;
            clientConfig.smtpUser = smtpUser
              ? encryptForClient(smtpUser, clientConfig)
              : null;
            clientConfig.smtpPassword = smtpPassword
              ? encryptForClient(smtpPassword, clientConfig)
              : null;
            clientConfig.smtpFrom = smtpFrom || null;
          } else if (emailProvider === 'SES') {
            clientConfig.sesRegion = sesRegion || null;
            clientConfig.sesAccessKeyId = sesAccessKeyId
              ? encryptForClient(sesAccessKeyId, clientConfig)
              : null;
            clientConfig.sesSecretAccessKey = sesSecretAccessKey
              ? encryptForClient(sesSecretAccessKey, clientConfig)
              : null;
            clientConfig.sesFrom = sesFrom || null;
          }
        }

        await manager.save(clientConfig);

        const client = new Client();
        client.name = name;
        client.description = description;
        client.status = STATUS.ACTIVE;
        client.configId = clientConfig.id;
        client.config = clientConfig;
        client.createdBy = loggedInId;
        await manager.save(client);

        // Seed default per-client roles
        const adminRole = new Role();
        adminRole.name = 'Administrator';
        adminRole.description = 'Full client access';
        adminRole.permissions = JSON.stringify(CLIENT_ADMIN_PERMISSIONS);
        adminRole.scope = 'ORG';
        adminRole.isDefault = IS_DEFAULT.YES;
        adminRole.clientId = client.id;
        adminRole.clientName = client.name;
        adminRole.status = STATUS.ACTIVE;
        const savedAdminRole = await manager.save(adminRole);

        const memberRole = new Role();
        memberRole.name = 'Member';
        memberRole.description = 'Standard user access';
        memberRole.permissions = JSON.stringify(CLIENT_USER_PERMISSIONS);
        memberRole.scope = 'ORG';
        memberRole.isDefault = IS_DEFAULT.YES;
        memberRole.clientId = client.id;
        memberRole.clientName = client.name;
        memberRole.status = STATUS.ACTIVE;
        const savedMemberRole = await manager.save(memberRole);

        // Seed default groups bound to the roles
        const adminGroup = new Group();
        adminGroup.name = 'Administrators';
        adminGroup.description = 'Full client access';
        adminGroup.clientId = client.id;
        adminGroup.clientName = client.name;
        adminGroup.roleId = savedAdminRole.id;
        adminGroup.isDefault = IS_DEFAULT.YES;
        adminGroup.status = STATUS.ACTIVE;
        adminGroup.createdBy = loggedInId;
        const savedAdminGroup = await manager.save(adminGroup);

        const memberGroup = new Group();
        memberGroup.name = 'Members';
        memberGroup.description = 'Standard user access';
        memberGroup.clientId = client.id;
        memberGroup.clientName = client.name;
        memberGroup.roleId = savedMemberRole.id;
        memberGroup.isDefault = IS_DEFAULT.YES;
        memberGroup.status = STATUS.ACTIVE;
        memberGroup.createdBy = loggedInId;
        await manager.save(memberGroup);

        // Bootstrap client admin user
        const clientAdmin = new User();
        clientAdmin.firstName = MASTER_ADMIN.FIRST_NAME;
        clientAdmin.lastName = MASTER_ADMIN.LAST_NAME;
        clientAdmin.email = adminEmail;
        clientAdmin.username = MASTER_ADMIN.USER_NAME;
        clientAdmin.status = STATUS.ACTIVE;
        clientAdmin.clientName = client.name;
        clientAdmin.clientId = client.id;
        clientAdmin.createdBy = loggedInId;
        clientAdmin.isDefault = IS_DEFAULT.YES;
        clientAdmin.locale = adminLocale;

        const setupToken = generateSetupToken();
        clientAdmin.setupToken = encryptForClient(setupToken, clientConfig);
        clientAdmin.setupTokenExpiresAt = new Date(
          Date.now() + SETUP_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
        );
        await manager.save(clientAdmin);

        const adminMapping = new UserGroupMapping();
        adminMapping.userId = clientAdmin.id;
        adminMapping.groupId = savedAdminGroup.id;
        await manager.save(adminMapping);

        return { client, clientConfig, clientAdmin, setupToken };
      },
    );

    const { client, clientConfig, clientAdmin, setupToken } = result;

    Logger.info(`Client Admin created successfully.`);

    const clientEmailConfig: ClientEmailConfig | undefined =
      clientConfig.emailProvider
        ? {
            emailProvider: clientConfig.emailProvider,
            smtpHost: clientConfig.smtpHost,
            smtpPort: clientConfig.smtpPort,
            smtpUser: clientConfig.smtpUser
              ? decryptForClient(clientConfig.smtpUser, clientConfig)
              : null,
            smtpPassword: clientConfig.smtpPassword
              ? decryptForClient(clientConfig.smtpPassword, clientConfig)
              : null,
            smtpFrom: clientConfig.smtpFrom,
            sesRegion: clientConfig.sesRegion,
            sesAccessKeyId: clientConfig.sesAccessKeyId
              ? decryptForClient(clientConfig.sesAccessKeyId, clientConfig)
              : null,
            sesSecretAccessKey: clientConfig.sesSecretAccessKey
              ? decryptForClient(clientConfig.sesSecretAccessKey, clientConfig)
              : null,
            sesFrom: clientConfig.sesFrom,
          }
        : undefined;

    const fullName =
      `${MASTER_ADMIN.FIRST_NAME || ''} ${MASTER_ADMIN.LAST_NAME || ''}`.trim();

    welcomeEmailToUser(
      adminEmail,
      fullName,
      MASTER_ADMIN.USER_NAME,
      client.name,
      clientAdmin.id,
      client.id,
      setupToken,
      clientEmailConfig,
      adminLocale,
    );
    Logger.info(`Setup email sent to ${adminEmail}`);

    sendResponse(res, true, CODE.SUCCESS, CLIENT_MSG.CREATED, client);
  } catch (error) {
    Logger.error(`Error while creating Client: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default addClient;
