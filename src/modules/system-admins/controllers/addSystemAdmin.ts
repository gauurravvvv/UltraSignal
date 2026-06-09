/**
 * addSystemAdmin — creates a new system administrator account.
 *
 * System admins are stored as User rows belonging to the seed System
 * Client. They inherit the System Admin permission set via the
 * System Administrators group → System Admin Role chain seeded at first
 * boot (see `seedSystemAdminRole`).
 *
 * No password is set here. Instead, a time-limited setup token is
 * generated and emailed to the new admin. They must click the link to
 * set their own password before they can log in.
 *
 * The welcome email is fire-and-forget — a delivery failure is logged
 * but does not roll back the account creation.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import {
  CODE,
  IS_DEFAULT,
  SETUP_TOKEN_EXPIRY_HOURS,
  STATUS,
  SYSTEM_CLIENT,
} from '../../../../config/config';
import {
  GENERIC,
  SYSTEM_ADMIN as SYSTEM_ADMIN_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { Group } from '../../../shared/db/entities/group.entity';
import { Client } from '../../../shared/db/entities/client.entity';
import { Role } from '../../../shared/db/entities/role.entity';
import { UserGroupMapping } from '../../../shared/db/entities/user-group-mapping.entity';
import { User } from '../../../shared/db/entities/user.entity';
import { encryptForClient } from '../../../shared/services/crypto.service';
import { generateSetupToken } from '../../../shared/utility/generateSetupToken';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import welcomeEmailToUser from '../../../shared/utility/mail/welcomeEmailToUser';
import sendResponse from '../../../shared/utility/response';

const addSystemAdmin = async (req: Request, res: Response) => {
  Logger.info(`Add System Admin request`);

  const { email, username, firstName, lastName } = req.body;
  const { loggedInId } = res.locals;

  try {
    // The seed System Client is the container for every system
    // admin. Without it the whole platform bootstrap is broken.
    const seedOrg = await Client.findOne({
      where: { name: SYSTEM_CLIENT.NAME, isDefault: IS_DEFAULT.YES },
    });

    if (!seedOrg) {
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        'System Admin client not found',
      );
    }

    // Find the seeded System Admin role + group so we can map the new
    // user into the group at creation time.
    const systemAdminRole = await AppDataSource.getRepository(Role).findOne({
      where: { scope: 'SYSTEM', clientId: seedOrg.id },
    });

    if (!systemAdminRole) {
      return sendResponse(
        res,
        false,
        CODE.SERVER_ERROR,
        'System Admin role not seeded',
      );
    }

    let systemAdminGroup = await AppDataSource.getRepository(Group).findOne({
      where: { roleId: systemAdminRole.id, clientId: seedOrg.id },
    });

    const setupToken = generateSetupToken();

    const created = await AppDataSource.transaction(
      async (manager: EntityManager) => {
        // Lazily create the System Administrators group if first-boot
        // onboardDB didn't (e.g. legacy DBs onboarded before this flow).
        if (!systemAdminGroup) {
          const g = new Group();
          g.name = 'System Administrators';
          g.description = 'Platform operators';
          g.clientId = seedOrg.id;
          g.clientName = seedOrg.name;
          g.roleId = systemAdminRole.id;
          g.isDefault = IS_DEFAULT.YES;
          g.status = STATUS.ACTIVE;
          systemAdminGroup = await manager.save(g);
        }

        const systemAdmin = new User();
        systemAdmin.firstName = firstName;
        systemAdmin.lastName = lastName;
        systemAdmin.email = email;
        systemAdmin.username = username;
        systemAdmin.status = STATUS.ACTIVE;
        systemAdmin.clientId = seedOrg.id;
        systemAdmin.clientName = SYSTEM_CLIENT.NAME;
        systemAdmin.createdBy = loggedInId;
        systemAdmin.setupToken = encryptForClient(setupToken);
        systemAdmin.setupTokenExpiresAt = new Date(
          Date.now() + SETUP_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
        );
        await manager.save(systemAdmin);

        const mapping = new UserGroupMapping();
        mapping.userId = systemAdmin.id;
        mapping.groupId = systemAdminGroup.id;
        await manager.save(mapping);

        return systemAdmin;
      },
    );

    const fullName = `${firstName || ''} ${lastName || ''}`.trim();
    welcomeEmailToUser(
      email,
      fullName,
      username,
      SYSTEM_CLIENT.NAME,
      created.id,
      seedOrg.id,
      setupToken,
    );

    sendResponse(res, true, CODE.SUCCESS, SYSTEM_ADMIN_MSG.CREATED, created);
  } catch (error) {
    Logger.error(`Error in addSystemAdmin: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default addSystemAdmin;
