import { DataSource } from 'typeorm';
import {
  DB_CONFIG,
  DB_TYPES,
  DEFAULT_SYSTEM_ADMIN_CREDS,
  SYSTEM_CLIENT,
} from '../../../config/config';
import { Client } from './entities/client.entity';
import onboardDB, { sendOnboardEmail } from '../helpers/system/onboardDB';
import onboardClient from '../helpers/system/onboardClient';
import seedAccessLevels from '../helpers/system/seedAccessLevels';
import seedDataSourceTypes from '../helpers/system/seedDataSourceTypes';
import seedPermissionCatalog from '../helpers/system/seedPermissionCatalog';
import seedScopes from '../helpers/system/seedScopes';
import seedStatisticalConstantsProfiles from '../helpers/system/seedStatisticalConstantsProfiles';
import seedSystemAdminRole from '../helpers/system/seedSystemAdminRole';
import seedThresholdProfiles from '../helpers/system/seedThresholdProfiles';
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

    // Step 1: always (re)seed the access-level + permission catalogs.
    // Both seeders are idempotent — every row upserts by its stable key,
    // so re-running on each boot just refreshes labels / icons / sequence
    // if the catalog evolved.
    //
    // Existing clients' Administrator roles are intentionally NOT updated
    // when new ORG-scope permissions appear in the catalog. The catalog
    // grows additively; the tenant Administrator opts into new
    // permissions via the role editor on their schedule. Only freshly
    // onboarded clients (via addClient) get FULL on every ORG leaf
    // available at the time of onboarding.
    await connection.manager.transaction(async manager => {
      await seedAccessLevels(manager);
      await seedPermissionCatalog(manager);
      await seedDataSourceTypes(manager);
      // Pharmacovigilance reference data. Scope must seed first because
      // threshold + stats-constants profiles reference scope by code.
      await seedScopes(manager);
      await seedThresholdProfiles(manager);
      await seedStatisticalConstantsProfiles(manager);
    });

    // Step 2: ensure the platform System client (UG) exists. On the first
    // boot ever we also create the seed System Admin user; on every boot
    // afterwards we re-run `seedSystemAdminRole` so changes to the catalog
    // (e.g. a new SYSTEM-scope permission or a new cross-scope grant like
    // `home`) automatically backfill into the System Admin role's mappings.
    const sysClient = await connection.manager.getRepository(Client).findOne({
      where: { name: SYSTEM_CLIENT.NAME },
    });

    if (!sysClient) {
      // First boot — full bootstrap inside one transaction.
      const { clientId, userId, setupToken, fullName } =
        await connection.manager.transaction(async manager => {
          const clientId = await onboardClient(
            SYSTEM_CLIENT.NAME,
            SYSTEM_CLIENT.DESCRIPTION,
            manager,
          );
          const roleId = await seedSystemAdminRole(manager, clientId);
          const result = await onboardDB(
            DEFAULT_SYSTEM_ADMIN_CREDS.USER_NAME,
            DEFAULT_SYSTEM_ADMIN_CREDS.EMAIL,
            DEFAULT_SYSTEM_ADMIN_CREDS.FIRST_NAME,
            DEFAULT_SYSTEM_ADMIN_CREDS.LAST_NAME,
            clientId,
            roleId,
            manager,
          );
          return { clientId, ...result };
        });

      sendOnboardEmail(
        DEFAULT_SYSTEM_ADMIN_CREDS.EMAIL,
        fullName,
        DEFAULT_SYSTEM_ADMIN_CREDS.USER_NAME,
        clientId,
        userId,
        setupToken,
      );
    } else {
      // Subsequent boots — system client already exists. Re-run the
      // role seeder to backfill any new mappings the catalog now expects.
      await connection.manager.transaction(async manager => {
        await seedSystemAdminRole(manager, sysClient.id);
      });
    }
  };
}

export default Database;
