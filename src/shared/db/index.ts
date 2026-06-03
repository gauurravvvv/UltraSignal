import { DataSource } from 'typeorm';
import {
  DB_CONFIG,
  DB_TYPES,
  DEFAULT_SYSTEM_ADMIN_CREDS,
  SYSTEM_ORGANISATION,
} from '../../../config/config';
import onboardDB, { sendOnboardEmail } from '../helpers/system/onboardDB';
import onboardOrg from '../helpers/system/onboardOrg';
import seedSystemAdminRole from '../helpers/system/seedSystemAdminRole';
import Logger from '../utility/logger/logger';
import CustomLogger from '../utility/logger/typeORMLogger';
import { ALL_ENTITIES } from './entities/all_entities.constant';

export const AppDataSource = new DataSource({
  type: DB_TYPES.POSTGRES,
  host: DB_CONFIG.host,
  port: parseInt(DB_CONFIG.port || '5432', 10),
  database: DB_CONFIG.database,
  username: DB_CONFIG.user,
  password: DB_CONFIG.password,
  entities: ALL_ENTITIES,
  subscribers: [],
  logging: DB_CONFIG.logging === 'true',
  synchronize: DB_CONFIG.sync === 'true',
  logger: new CustomLogger(),
  extra: {
    max: 20,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  },
});

class Database {
  public connect = async (): Promise<void> => {
    const connection = await AppDataSource.initialize();

    Logger.http(`${DB_CONFIG.database} Database Connected!`);
    Logger.info(`DB URL: ${DB_CONFIG.host}`);

    const user: any[] = await connection.manager.query(
      `SELECT 1 FROM "user" LIMIT 1`,
    );
    if (!user.length) {
      const { orgId, userId, setupToken, fullName } =
        await connection.manager.transaction(async manager => {
          const orgId = await onboardOrg(
            SYSTEM_ORGANISATION.NAME,
            SYSTEM_ORGANISATION.DESCRIPTION,
            manager,
          );
          // Seed the System Admin Role row BEFORE the user so we can
          // hang its id off the user-group mapping. Both rows commit
          // in the same transaction so a failure mid-seed leaves the
          // DB in a clean (empty) state for the next boot to retry.
          const roleId = await seedSystemAdminRole(manager, orgId);
          const result = await onboardDB(
            DEFAULT_SYSTEM_ADMIN_CREDS.USER_NAME,
            DEFAULT_SYSTEM_ADMIN_CREDS.EMAIL,
            DEFAULT_SYSTEM_ADMIN_CREDS.FIRST_NAME,
            DEFAULT_SYSTEM_ADMIN_CREDS.LAST_NAME,
            orgId,
            roleId,
            manager,
          );
          return { orgId, ...result };
        });

      sendOnboardEmail(
        DEFAULT_SYSTEM_ADMIN_CREDS.EMAIL,
        fullName,
        DEFAULT_SYSTEM_ADMIN_CREDS.USER_NAME,
        orgId,
        userId,
        setupToken,
      );
    }
  };
}

export default Database;
