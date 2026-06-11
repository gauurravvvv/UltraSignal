/**
 * backfillAdminRoleMappings — refreshes every per-client Administrator
 * role so it carries FULL on every active, non-mandatory ORG-scope
 * permission currently in the catalog.
 *
 * Why this exists: `addClient.ts` grants Administrator FULL on every ORG
 * leaf at client-creation time, but the catalog can grow afterwards (e.g.
 * `dataSource`, `detectionMethod`, `alertRuns` added later). Without a
 * backfill, existing tenants' Administrator role would still be locked
 * to the older permission set. This helper closes that drift on every
 * boot.
 *
 * Idempotent: only INSERTS missing mappings. Never touches existing rows
 * — if an Administrator's mapping was somehow downgraded (it shouldn't
 * be, since the Administrator role is default and updateRole guards
 * against editing defaults), this helper does NOT raise it back to FULL.
 * That's intentional: this is a backfill for net-new permissions, not a
 * reconciler for tampered grants.
 *
 * Mandatory permissions are excluded by `getPermissionIdsByScope` —
 * mandatory grants are implicit at read time, no mapping row needed.
 */
import { EntityManager } from 'typeorm';
import { ACCESS } from '../../constants/permissions/access';
import { RolePermissionMapping } from '../../db/entities/role-permission-mapping.entity';
import { Role } from '../../db/entities/role.entity';
import Logger from '../../utility/logger/logger';
import { getPermissionIdsByScope } from './seedPermissionCatalog';

const ADMINISTRATOR_ROLE_NAME = 'Administrator';

const backfillAdminRoleMappings = async (
  manager: EntityManager,
): Promise<void> => {
  // Every per-client Administrator role currently in the system.
  const admins = await manager.getRepository(Role).find({
    where: { name: ADMINISTRATOR_ROLE_NAME, scope: 'ORG', status: 1 },
  });

  if (admins.length === 0) {
    return; // fresh install — addClient will set mappings on first tenant
  }

  // All ORG-scope leaves the catalog currently knows about. Mandatory
  // perms (e.g. `home`) are excluded — they're granted implicitly.
  const orgLeaves = await getPermissionIdsByScope(manager, 'ORG');
  if (orgLeaves.length === 0) return;

  const mappingRepo = manager.getRepository(RolePermissionMapping);
  let inserted = 0;

  for (const admin of admins) {
    const existing = await mappingRepo.find({
      where: { roleId: admin.id },
      select: ['permissionId'],
    });
    const existingIds = new Set(existing.map(m => m.permissionId));

    const toInsert = orgLeaves
      .filter(p => !existingIds.has(p.id))
      .map(p => {
        const m = new RolePermissionMapping();
        m.roleId = admin.id;
        m.permissionId = p.id;
        m.level = ACCESS.FULL;
        return m;
      });

    if (toInsert.length > 0) {
      await mappingRepo.save(toInsert);
      inserted += toInsert.length;
    }
  }

  if (inserted > 0) {
    Logger.info(
      `Backfilled ${inserted} Administrator role mapping(s) across ${admins.length} client(s).`,
    );
  }
};

export default backfillAdminRoleMappings;
