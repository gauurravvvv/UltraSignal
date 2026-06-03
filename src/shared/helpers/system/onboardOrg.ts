/**
 * onboardOrg — creates the default Organisation and its config during first-run
 * database initialization.
 *
 * Called inside the master DB connection's `runInTransaction` alongside `onboardDB` so
 * both the org and the seed admin are committed atomically. The config row is saved
 * first so its generated `id` is available to set as `organisation.configId` — TypeORM
 * 0.2 does not auto-cascade inserts in the same save call for this relation shape.
 *
 * Default config values (5 login attempts, 1-hour lock, 5-password history, 30-min
 * inactivity) reflect the security baseline for a fresh installation and can be updated
 * by a System Admin afterwards.
 */
import { EntityManager } from 'typeorm';
import { IS_DEFAULT } from '../../../../config/config';
import { Organisation } from '../../db/entities/organisation.entity';
import { OrganisationConfig } from '../../db/entities/organisationConfig.entity';
import Logger from '../../utility/logger/logger';

const onboardOrg = async (
  name: string,
  description: string,
  manager: EntityManager,
) => {
  const orgConfig = new OrganisationConfig();
  orgConfig.maxLoginAttempts = 5;
  orgConfig.accountLockDurationHours = 1;
  orgConfig.passwordHistoryLimit = 5;
  orgConfig.sessionInactivityTimeout = 30;
  await manager.save(orgConfig);

  const organisation: Organisation = new Organisation();
  organisation.name = name;
  organisation.description = description;
  organisation.status = 1;
  organisation.isDefault = IS_DEFAULT.YES;
  organisation.configId = orgConfig.id;
  organisation.config = orgConfig;

  await manager.save(organisation);

  Logger.info(`Default Organisation: ${name} created successfully`);

  return organisation.id;
};

export default onboardOrg;
