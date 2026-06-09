/**
 * seedSystemAdminRole — ensures the platform-level `Role` row exists and
 * grants it FULL on every SYSTEM-scope permission via the
 * `role_permission_mapping` table.
 *
 * Called once in the first-boot transaction (between `onboardClient` and
 * `onboardDB`). The seeded row carries `scope: 'SYSTEM'` so it can be
 * distinguished from per-client roles. It still carries the seed
 * client's id so client-scoped queries stay consistent.
 *
 * Idempotent in two ways:
 *   1. The role row itself — if it already exists, reused.
 *   2. The mapping rows — each (role_id, permission_id) pair is upserted;
 *      re-running just refreshes the level if it drifted.
 *
 * The set of SYSTEM permissions comes from `seedPermissionCatalog`
 * (which runs earlier in the boot sequence).
 */
import { EntityManager } from 'typeorm';
import { IS_DEFAULT, STATUS } from '../../../../config/config';
import { ACCESS } from '../../constants/permissions/access';
import { Role } from '../../db/entities/role.entity';
import { RolePermissionMapping } from '../../db/entities/role-permission-mapping.entity';
import Logger from '../../utility/logger/logger';
import {
  getPermissionIdByValue,
  getPermissionIdsByScope,
} from './seedPermissionCatalog';

/**
 * Cross-scope permissions that the System Admin should always carry, in
 * addition to every SYSTEM-scope leaf. `home` is the landing page — it
 * lives in the catalog as ORG-scope so per-client users get it, but the
 * System Admin also needs it as their post-login destination.
 */
const CROSS_SCOPE_GRANTS_FOR_SYSTEM_ADMIN = ['home'] as const;

const SYSTEM_ADMIN_ROLE_NAME = 'System Admin';

const seedSystemAdminRole = async (
  manager: EntityManager,
  clientId: string,
): Promise<string> => {
  const roleRepo = manager.getRepository(Role);

  let role = await roleRepo.findOne({
    where: { name: SYSTEM_ADMIN_ROLE_NAME, scope: 'SYSTEM' },
  });

  if (!role) {
    role = new Role();
    role.name = SYSTEM_ADMIN_ROLE_NAME;
    role.description =
      'Operates the platform: onboards clients, manages other system ' +
      'admins. No access to per-client data.';
    role.scope = 'SYSTEM';
    role.clientId = clientId;
    role.isDefault = IS_DEFAULT.YES;
    role.status = STATUS.ACTIVE;
    role = await roleRepo.save(role);
    Logger.info(`System Admin Role seeded (id: ${role.id})`);
  }

  const mappingRepo = manager.getRepository(RolePermissionMapping);

  /** Idempotent upsert of one (role, permission) → FULL grant. */
  const upsertFull = async (permissionId: string): Promise<void> => {
    const existing = await mappingRepo.findOne({
      where: { roleId: role.id, permissionId },
    });
    if (existing) {
      if (existing.level !== ACCESS.FULL) {
        existing.level = ACCESS.FULL;
        await mappingRepo.save(existing);
      }
      return;
    }
    const m = new RolePermissionMapping();
    m.roleId = role.id;
    m.permissionId = permissionId;
    m.level = ACCESS.FULL;
    await mappingRepo.save(m);
  };

  // 1. FULL on every SYSTEM-scope permission leaf.
  const systemPerms = await getPermissionIdsByScope(manager, 'SYSTEM');
  for (const p of systemPerms) await upsertFull(p.id);

  // 2. FULL on cross-scope permissions System Admin always needs
  //    (`home` etc. — they live in the catalog under ORG scope but the
  //    System Admin still needs them, e.g. for the post-login landing page).
  for (const value of CROSS_SCOPE_GRANTS_FOR_SYSTEM_ADMIN) {
    const id = await getPermissionIdByValue(manager, value);
    await upsertFull(id);
  }

  return role.id;
};

export default seedSystemAdminRole;
