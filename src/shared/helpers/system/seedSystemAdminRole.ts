/**
 * seedSystemAdminRole — ensures the `Role` row that holds the System
 * Admin permission set exists, and returns its id.
 *
 * Called once in the first-boot transaction (between `onboardOrg` and
 * `onboardDB`). The seeded row carries `scope: 'SYSTEM'` so it can be
 * distinguished from per-org roles, but still carries the seed
 * organisation's id so org-scoped queries stay consistent.
 *
 * Idempotent — if the row already exists, just returns the existing id
 * without rewriting permissions.
 *
 * The permission JSON is sourced from `SYSTEM_ADMIN_PERMISSIONS_V2`.
 * Once the row is in the DB, the constant file becomes reference-only —
 * login and permission middleware read from the table.
 */
import { EntityManager } from 'typeorm';
import { IS_DEFAULT, STATUS } from '../../../../config/config';
import { SYSTEM_ADMIN_PERMISSIONS_V2 } from '../../constants/permissions/systemAdminV2';
import { Role } from '../../db/entities/role.entity';
import Logger from '../../utility/logger/logger';

const SYSTEM_ADMIN_ROLE_NAME = 'System Admin';

const seedSystemAdminRole = async (
  manager: EntityManager,
  orgId: string,
): Promise<string> => {
  const existing = await manager.getRepository(Role).findOne({
    where: { name: SYSTEM_ADMIN_ROLE_NAME, scope: 'SYSTEM' },
  });
  if (existing) {
    return existing.id;
  }

  const role = new Role();
  role.name = SYSTEM_ADMIN_ROLE_NAME;
  role.description =
    'Operates the platform: onboards organisations, manages other ' +
    'system admins, ships announcements, reviews cross-org audit. ' +
    'No access to per-organisation data.';
  role.permissions = JSON.stringify(SYSTEM_ADMIN_PERMISSIONS_V2);
  role.scope = 'SYSTEM';
  role.organisationId = orgId;
  role.isDefault = IS_DEFAULT.YES;
  role.status = STATUS.ACTIVE;

  const saved = await manager.save(role);

  Logger.info(`Default System Admin Role seeded (id: ${saved.id})`);

  return saved.id;
};

export default seedSystemAdminRole;
