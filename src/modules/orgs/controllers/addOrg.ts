/**
 * addOrg — provisions a new tenant organisation inside the single AppDataSource.
 *
 * All rows commit in a single transaction:
 *  - OrganisationConfig (with envelope-encrypted DEK, security policy, email config)
 *  - Organisation
 *  - Two default per-org roles (Administrator, Member)
 *  - Two default groups (Administrators, Members) bound to the roles
 *  - The bootstrap org admin User
 *  - The UserGroupMapping joining admin user to Administrators group
 *
 * Email credentials (SMTP user/password, SES keys) are stored encrypted with the
 * org's own DEK so they cannot be decrypted without that key.
 *
 * The welcome email to the org admin is sent after the transaction commits so a
 * mail-delivery failure does not roll back the org creation.
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
import { ORG_ADMIN_PERMISSIONS } from '../../../shared/constants/permissions/organisationAdmin';
import { ORG_USER_PERMISSIONS } from '../../../shared/constants/permissions/user';
import {
  GENERIC,
  ORGANISATION as ORGANISATION_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { Group } from '../../../shared/db/entities/group.entity';
import { Organisation } from '../../../shared/db/entities/organisation.entity';
import { OrganisationConfig } from '../../../shared/db/entities/organisationConfig.entity';
import { Role } from '../../../shared/db/entities/role.entity';
import { UserGroupMapping } from '../../../shared/db/entities/user-group-mapping.entity';
import { User } from '../../../shared/db/entities/user.entity';
import {
  decryptForOrg,
  encryptForOrg,
  generateDek,
  wrapDek,
} from '../../../shared/services/crypto.service';
import { generateSetupToken } from '../../../shared/utility/generateSetupToken';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import { OrgEmailConfig } from '../../../shared/utility/mail';
import welcomeEmailToUser from '../../../shared/utility/mail/welcomeEmailToUser';
import sendResponse from '../../../shared/utility/response';

const addOrg = async (req: Request, res: Response) => {
  Logger.info(`Add Organisation request`);

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
    // Generate this org's data-encryption key (DEK) and wrap it under
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
        const orgConfig = new OrganisationConfig();
        orgConfig.createdBy = loggedInId;
        orgConfig.encryptedDek = encryptedDek;
        // Legacy columns intentionally left null on new orgs — the
        // migrate-on-read helper treats `encryptedDek != null` as
        // "already on the new scheme; skip migration".
        orgConfig.pepperKey = null;
        orgConfig.encryptionAlgorithm = null;

        if (maxLoginAttempts !== undefined)
          orgConfig.maxLoginAttempts = maxLoginAttempts;
        if (accountLockDurationHours !== undefined)
          orgConfig.accountLockDurationHours = accountLockDurationHours;
        if (passwordHistoryLimit !== undefined)
          orgConfig.passwordHistoryLimit = passwordHistoryLimit;
        if (sessionInactivityTimeout !== undefined)
          orgConfig.sessionInactivityTimeout = sessionInactivityTimeout;

        if (emailProvider) {
          orgConfig.emailProvider = emailProvider;
          if (emailProvider === 'SMTP') {
            orgConfig.smtpHost = smtpHost || null;
            orgConfig.smtpPort = smtpPort || null;
            orgConfig.smtpUser = smtpUser
              ? encryptForOrg(smtpUser, orgConfig)
              : null;
            orgConfig.smtpPassword = smtpPassword
              ? encryptForOrg(smtpPassword, orgConfig)
              : null;
            orgConfig.smtpFrom = smtpFrom || null;
          } else if (emailProvider === 'SES') {
            orgConfig.sesRegion = sesRegion || null;
            orgConfig.sesAccessKeyId = sesAccessKeyId
              ? encryptForOrg(sesAccessKeyId, orgConfig)
              : null;
            orgConfig.sesSecretAccessKey = sesSecretAccessKey
              ? encryptForOrg(sesSecretAccessKey, orgConfig)
              : null;
            orgConfig.sesFrom = sesFrom || null;
          }
        }

        await manager.save(orgConfig);

        const org = new Organisation();
        org.name = name;
        org.description = description;
        org.status = STATUS.ACTIVE;
        org.configId = orgConfig.id;
        org.config = orgConfig;
        org.createdBy = loggedInId;
        await manager.save(org);

        // Seed default per-org roles
        const adminRole = new Role();
        adminRole.name = 'Administrator';
        adminRole.description = 'Full organisation access';
        adminRole.permissions = JSON.stringify(ORG_ADMIN_PERMISSIONS);
        adminRole.scope = 'ORG';
        adminRole.isDefault = IS_DEFAULT.YES;
        adminRole.organisationId = org.id;
        adminRole.organisationName = org.name;
        adminRole.status = STATUS.ACTIVE;
        const savedAdminRole = await manager.save(adminRole);

        const memberRole = new Role();
        memberRole.name = 'Member';
        memberRole.description = 'Standard user access';
        memberRole.permissions = JSON.stringify(ORG_USER_PERMISSIONS);
        memberRole.scope = 'ORG';
        memberRole.isDefault = IS_DEFAULT.YES;
        memberRole.organisationId = org.id;
        memberRole.organisationName = org.name;
        memberRole.status = STATUS.ACTIVE;
        const savedMemberRole = await manager.save(memberRole);

        // Seed default groups bound to the roles
        const adminGroup = new Group();
        adminGroup.name = 'Administrators';
        adminGroup.description = 'Full organisation access';
        adminGroup.organisationId = org.id;
        adminGroup.organisationName = org.name;
        adminGroup.roleId = savedAdminRole.id;
        adminGroup.isDefault = IS_DEFAULT.YES;
        adminGroup.status = STATUS.ACTIVE;
        adminGroup.createdBy = loggedInId;
        const savedAdminGroup = await manager.save(adminGroup);

        const memberGroup = new Group();
        memberGroup.name = 'Members';
        memberGroup.description = 'Standard user access';
        memberGroup.organisationId = org.id;
        memberGroup.organisationName = org.name;
        memberGroup.roleId = savedMemberRole.id;
        memberGroup.isDefault = IS_DEFAULT.YES;
        memberGroup.status = STATUS.ACTIVE;
        memberGroup.createdBy = loggedInId;
        await manager.save(memberGroup);

        // Bootstrap org admin user
        const orgAdmin = new User();
        orgAdmin.firstName = MASTER_ADMIN.FIRST_NAME;
        orgAdmin.lastName = MASTER_ADMIN.LAST_NAME;
        orgAdmin.email = adminEmail;
        orgAdmin.username = MASTER_ADMIN.USER_NAME;
        orgAdmin.status = STATUS.ACTIVE;
        orgAdmin.organisationName = org.name;
        orgAdmin.organisationId = org.id;
        orgAdmin.createdBy = loggedInId;
        orgAdmin.isDefault = IS_DEFAULT.YES;
        orgAdmin.locale = adminLocale;

        const setupToken = generateSetupToken();
        orgAdmin.setupToken = encryptForOrg(setupToken, orgConfig);
        orgAdmin.setupTokenExpiresAt = new Date(
          Date.now() + SETUP_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
        );
        await manager.save(orgAdmin);

        const adminMapping = new UserGroupMapping();
        adminMapping.userId = orgAdmin.id;
        adminMapping.groupId = savedAdminGroup.id;
        await manager.save(adminMapping);

        return { org, orgConfig, orgAdmin, setupToken };
      },
    );

    const { org, orgConfig, orgAdmin, setupToken } = result;

    Logger.info(`Organisation Admin created successfully.`);

    const orgEmailConfig: OrgEmailConfig | undefined = orgConfig.emailProvider
      ? {
          emailProvider: orgConfig.emailProvider,
          smtpHost: orgConfig.smtpHost,
          smtpPort: orgConfig.smtpPort,
          smtpUser: orgConfig.smtpUser
            ? decryptForOrg(orgConfig.smtpUser, orgConfig)
            : null,
          smtpPassword: orgConfig.smtpPassword
            ? decryptForOrg(orgConfig.smtpPassword, orgConfig)
            : null,
          smtpFrom: orgConfig.smtpFrom,
          sesRegion: orgConfig.sesRegion,
          sesAccessKeyId: orgConfig.sesAccessKeyId
            ? decryptForOrg(orgConfig.sesAccessKeyId, orgConfig)
            : null,
          sesSecretAccessKey: orgConfig.sesSecretAccessKey
            ? decryptForOrg(orgConfig.sesSecretAccessKey, orgConfig)
            : null,
          sesFrom: orgConfig.sesFrom,
        }
      : undefined;

    const fullName =
      `${MASTER_ADMIN.FIRST_NAME || ''} ${MASTER_ADMIN.LAST_NAME || ''}`.trim();

    welcomeEmailToUser(
      adminEmail,
      fullName,
      MASTER_ADMIN.USER_NAME,
      org.name,
      orgAdmin.id,
      org.id,
      setupToken,
      orgEmailConfig,
      adminLocale,
    );
    Logger.info(`Setup email sent to ${adminEmail}`);

    sendResponse(res, true, CODE.SUCCESS, ORGANISATION_MSG.CREATED, org);
  } catch (error) {
    Logger.error(
      `Error while creating Organisation: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default addOrg;
