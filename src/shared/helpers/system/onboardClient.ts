/**
 * onboardClient — creates the default Client and its config during first-run
 * database initialization.
 *
 * Called inside the master DB connection's `runInTransaction` alongside `onboardDB` so
 * both the client and the seed admin are committed atomically. The config row is saved
 * first so its generated `id` is available to set as `client.configId` — TypeORM
 * 0.2 does not auto-cascade inserts in the same save call for this relation shape.
 *
 * Default config values (5 login attempts, 1-hour lock, 5-password history, 30-min
 * inactivity) reflect the security baseline for a fresh installation and can be updated
 * by a System Admin afterwards.
 */
import { EntityManager } from 'typeorm';
import {
  DEFAULT_CLIENT_CONFIG,
  IS_DEFAULT,
  STATUS,
} from '../../../../config/config';
import { Client } from '../../db/entities/client.entity';
import { ClientConfig } from '../../db/entities/clientConfig.entity';
import Logger from '../../utility/logger/logger';

const onboardClient = async (
  name: string,
  description: string,
  manager: EntityManager,
) => {
  const clientConfig = new ClientConfig();
  clientConfig.maxLoginAttempts = DEFAULT_CLIENT_CONFIG.maxLoginAttempts;
  clientConfig.accountLockDurationHours =
    DEFAULT_CLIENT_CONFIG.accountLockDurationHours;
  clientConfig.passwordHistoryLimit =
    DEFAULT_CLIENT_CONFIG.passwordHistoryLimit;
  clientConfig.sessionInactivityTimeout =
    DEFAULT_CLIENT_CONFIG.sessionInactivityTimeout;
  await manager.save(clientConfig);

  const client: Client = new Client();
  client.name = name;
  client.description = description;
  client.status = STATUS.ACTIVE;
  client.isDefault = IS_DEFAULT.YES;
  client.configId = clientConfig.id;
  client.config = clientConfig;
  client.clientCode = '0000';

  await manager.save(client);

  Logger.info(`Default Client: ${name} created successfully`);

  return client.id;
};

export default onboardClient;
