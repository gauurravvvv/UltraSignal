/**
 * addClient — provisions a new tenant client inside the single AppDataSource.
 *
 * All rows commit in a single transaction:
 *  - ClientConfig (security policy + optional email config)
 *  - Client
 *  - Two default per-client roles (Administrator, Member)
 *  - Two default groups (Administrators, Members) bound to the roles
 *  - The bootstrap client admin User
 *  - The UserGroupMapping joining admin user to Administrators group
 *
 * Email credentials (SMTP user/password, SES keys) are stored encrypted with the
 * platform master key (env: ULTRASIGNAL_MASTER_KEY) — see shared/services/crypto.service.ts.
 *
 * The welcome email to the client admin is sent after the transaction commits so a
 * mail-delivery failure does not roll back the client creation.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import {
  CODE,
  IS_DEFAULT,
  SETUP_TOKEN_EXPIRY_HOURS,
  STATUS,
} from '../../../../config/config';
import { ACCESS } from '../../../shared/constants/permissions/access';
import { RolePermissionMapping } from '../../../shared/db/entities/role-permission-mapping.entity';
import { getPermissionIdsByScope } from '../../../shared/helpers/system/seedPermissionCatalog';
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
} from '../../../shared/services/crypto.service';
import { generateSetupToken } from '../../../shared/utility/generateSetupToken';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import { ClientEmailConfig } from '../../../shared/utility/mail';
import welcomeEmailToUser from '../../../shared/utility/mail/welcomeEmailToUser';
import sendResponse from '../../../shared/utility/response';

const addClient = async (req: Request, res: Response) => {
  Logger.info(`Add Client request`);

  const {
    name,
    clientCode,
    description,
    adminFirstName,
    adminLastName,
    adminUsername,
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
    const result = await AppDataSource.transaction(
      async (manager: EntityManager) => {
        const clientConfig = new ClientConfig();
        clientConfig.createdBy = loggedInId;

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
              ? encryptForClient(smtpUser)
              : null;
            clientConfig.smtpPassword = smtpPassword
              ? encryptForClient(smtpPassword)
              : null;
            clientConfig.smtpFrom = smtpFrom || null;
          } else if (emailProvider === 'SES') {
            clientConfig.sesRegion = sesRegion || null;
            clientConfig.sesAccessKeyId = sesAccessKeyId
              ? encryptForClient(sesAccessKeyId)
              : null;
            clientConfig.sesSecretAccessKey = sesSecretAccessKey
              ? encryptForClient(sesSecretAccessKey)
              : null;
            clientConfig.sesFrom = sesFrom || null;
          }
        }

        await manager.save(clientConfig);

        const client = new Client();
        client.name = name;
        client.clientCode = clientCode;
        client.description = description;
        client.status = STATUS.ACTIVE;
        client.configId = clientConfig.id;
        client.config = clientConfig;
        client.createdBy = loggedInId;
        await manager.save(client);

        // Seed default per-client roles. The role row carries only
        // metadata; permission grants live in role_permission_mapping.
        const adminRole = new Role();
        adminRole.name = 'Administrator';
        adminRole.description = 'Full client access';
        adminRole.scope = 'ORG';
        adminRole.isDefault = IS_DEFAULT.YES;
        adminRole.clientId = client.id;
        adminRole.clientName = client.name;
        adminRole.status = STATUS.ACTIVE;
        const savedAdminRole = await manager.save(adminRole);

        const memberRole = new Role();
        memberRole.name = 'Member';
        memberRole.description = 'Standard user access';
        memberRole.scope = 'ORG';
        memberRole.isDefault = IS_DEFAULT.YES;
        memberRole.clientId = client.id;
        memberRole.clientName = client.name;
        memberRole.status = STATUS.ACTIVE;
        const savedMemberRole = await manager.save(memberRole);

        // Administrator: FULL on every ORG-scope permission leaf.
        const orgLeaves = await getPermissionIdsByScope(manager, 'ORG');
        if (orgLeaves.length > 0) {
          const adminMappings = orgLeaves.map(p => {
            const m = new RolePermissionMapping();
            m.roleId = savedAdminRole.id;
            m.permissionId = p.id;
            m.level = ACCESS.FULL;
            m.createdBy = loggedInId;
            return m;
          });
          await manager
            .getRepository(RolePermissionMapping)
            .save(adminMappings);
        }

        // Member: no permission mappings on creation. The Home landing
        // page is permanent for every authenticated user and is not a
        // permission. The tenant Administrator adds grants via the role
        // editor as their org's needs are defined.

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

        // Bootstrap client admin user. Identity comes from the request
        // body now — the legacy MASTER_ADMIN constants only act as
        // fallbacks for callers that don't supply the admin* fields
        // (the validator requires them today, so the fallbacks are
        // defensive only).
        const clientAdmin = new User();
        clientAdmin.firstName = adminFirstName;
        clientAdmin.lastName = adminLastName;
        clientAdmin.email = adminEmail;
        clientAdmin.username = adminUsername;
        clientAdmin.status = STATUS.ACTIVE;
        clientAdmin.clientName = client.name;
        clientAdmin.clientId = client.id;
        clientAdmin.createdBy = loggedInId;
        clientAdmin.isDefault = IS_DEFAULT.YES;
        clientAdmin.locale = adminLocale;

        const setupToken = generateSetupToken();
        clientAdmin.setupToken = encryptForClient(setupToken);
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
              ? decryptForClient(clientConfig.smtpUser)
              : null,
            smtpPassword: clientConfig.smtpPassword
              ? decryptForClient(clientConfig.smtpPassword)
              : null,
            smtpFrom: clientConfig.smtpFrom,
            sesRegion: clientConfig.sesRegion,
            sesAccessKeyId: clientConfig.sesAccessKeyId
              ? decryptForClient(clientConfig.sesAccessKeyId)
              : null,
            sesSecretAccessKey: clientConfig.sesSecretAccessKey
              ? decryptForClient(clientConfig.sesSecretAccessKey)
              : null,
            sesFrom: clientConfig.sesFrom,
          }
        : undefined;

    const fullName =
      `${clientAdmin.firstName || ''} ${clientAdmin.lastName || ''}`.trim();

    welcomeEmailToUser(
      adminEmail,
      fullName,
      clientAdmin.username,
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
