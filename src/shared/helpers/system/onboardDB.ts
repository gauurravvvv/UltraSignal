/**
 * onboardDB — creates the default System Admin user during first-run
 * database initialization, plus the group + group mapping that grants
 * the user the seeded System Admin role's permissions.
 *
 * Called inside the AppDataSource transaction in `src/shared/db/index.ts`
 * after the schema is synchronized — the `manager` parameter ensures the
 * inserts are part of the same transaction so the DB isn't left in a
 * half-initialized state.
 *
 * `isDefault: 1` marks this user as the seed admin so the auto-onboard
 * gate in `db/index.ts` knows to skip re-creation on subsequent restarts.
 *
 * `sendOnboardEmail` is separated from `onboardDB` so the transaction
 * can commit before the email fires — email delivery failures should
 * not roll back the admin creation.
 */
import { EntityManager } from 'typeorm';
import {
  IS_DEFAULT,
  SETUP_TOKEN_EXPIRY_HOURS,
  STATUS,
  SYSTEM_CLIENT,
} from '../../../../config/config';
import { Group } from '../../db/entities/group.entity';
import { UserGroupMapping } from '../../db/entities/user-group-mapping.entity';
import { User } from '../../db/entities/user.entity';
import { encryptForClient } from '../../services/crypto.service';
import { generateSetupToken } from '../../utility/generateSetupToken';
import Logger from '../../utility/logger/logger';
import welcomeEmailToUser from '../../utility/mail/welcomeEmailToUser';

const SYSTEM_ADMIN_GROUP_NAME = 'System Administrators';

const onboardDB = async (
  username: string,
  email: string,
  firstName: string,
  lastName: string,
  clientId: string,
  roleId: string,
  manager: EntityManager,
) => {
  const user: User = new User();
  user.firstName = firstName;
  user.lastName = lastName;
  user.email = email;
  user.username = username;
  user.isDefault = IS_DEFAULT.YES;
  user.status = STATUS.ACTIVE;
  user.clientName = SYSTEM_CLIENT.NAME;
  user.clientId = clientId;

  const setupToken = generateSetupToken();
  user.setupToken = encryptForClient(setupToken);
  user.setupTokenExpiresAt = new Date(
    Date.now() + SETUP_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
  );

  await manager.save(user);

  // Seed the System Administrators group, link it to the System Admin
  // role, and map the user into it. Permissions resolve at login via
  // User → UserGroupMapping → Group → Role.
  const adminGroup = new Group();
  adminGroup.name = SYSTEM_ADMIN_GROUP_NAME;
  adminGroup.description = 'Platform operators (auto-seeded).';
  adminGroup.clientId = clientId;
  adminGroup.clientName = SYSTEM_CLIENT.NAME;
  adminGroup.roleId = roleId;
  adminGroup.isDefault = IS_DEFAULT.YES;
  adminGroup.status = STATUS.ACTIVE;
  const savedGroup = await manager.save(adminGroup);

  const mapping = new UserGroupMapping();
  mapping.userId = user.id;
  mapping.groupId = savedGroup.id;
  await manager.save(mapping);

  Logger.info(`System Admin: ${username} created successfully.`);

  return {
    userId: user.id,
    setupToken,
    fullName: `${firstName || ''} ${lastName || ''}`.trim(),
  };
};

export const sendOnboardEmail = (
  email: string,
  fullName: string,
  username: string,
  clientId: string,
  userId: string,
  setupToken: string,
) => {
  welcomeEmailToUser(
    email,
    fullName,
    username,
    SYSTEM_CLIENT.NAME,
    userId,
    clientId,
    setupToken,
  );
  Logger.info(`Setup email sent to ${email}`);
};

export default onboardDB;
