/**
 * seedPermissionCatalog — populates the `permission` table with the
 * canonical module + screen list on first boot.
 *
 * Idempotent: every permission is upserted by its unique `value`. Running
 * this twice on the same DB leaves it in the same state. Safe to call on
 * every boot.
 *
 * This is the ONE place the catalog lives at deploy time. Adding a new
 * module or screen later means adding rows directly via SQL or a small
 * admin UI — not editing this file. But this file IS the source-of-truth
 * for fresh deployments.
 *
 * Structure:
 *   - parent_id = NULL  →  a MODULE (top-level entry, sidebar header)
 *   - parent_id = <module>  →  a SCREEN under that module
 *   - scope = 'SYSTEM'  →  platform-only (System Admin role editor)
 *   - scope = 'ORG'     →  per-client (Administrator role editor)
 */
import { EntityManager } from 'typeorm';
import { Permission } from '../../db/entities/permission.entity';
import Logger from '../../utility/logger/logger';

interface ModuleSeed {
  value: string;
  name: string;
  icon?: string;
  sequence: number;
  scope: 'SYSTEM' | 'ORG';
  screens: ScreenSeed[];
}

interface ScreenSeed {
  value: string;
  name: string;
  icon?: string;
  sequence: number;
}

/**
 * The catalog — every module + every screen the platform knows about.
 * Keep this in sync with the route files: each value used in
 * `VerifyPermissionMiddleware('X', ...)` must appear here.
 */
const CATALOG: ModuleSeed[] = [
  // ── SYSTEM scope (platform operator only) ─────────────────
  {
    value: 'systemManagement',
    name: 'System Management',
    icon: 'ci ci-server',
    sequence: 1,
    scope: 'SYSTEM',
    screens: [
      { value: 'systemAdmin', name: 'System Admins', icon: 'ci ci-user-gear', sequence: 1 },
      { value: 'clientManagement', name: 'Clients', icon: 'ci ci-building', sequence: 2 },
    ],
  },

  // ── ORG scope (per-client) ────────────────────────────────
  {
    value: 'home',
    name: 'Home',
    icon: 'ci ci-home',
    sequence: 1,
    scope: 'ORG',
    screens: [],
  },
  {
    value: 'userManagement',
    name: 'User Management',
    icon: 'ci ci-site-map',
    sequence: 2,
    scope: 'ORG',
    screens: [
      { value: 'roles', name: 'Roles', icon: 'ci ci-shield-halved', sequence: 1 },
      { value: 'groups', name: 'Groups', icon: 'ci ci-user-group', sequence: 2 },
      { value: 'users', name: 'Users', icon: 'ci ci-users', sequence: 3 },
    ],
  },
  {
    value: 'businessConfig',
    name: 'Business Config',
    icon: 'ci ci-sliders',
    sequence: 3,
    scope: 'ORG',
    screens: [
      { value: 'productGroup', name: 'Product Group', icon: 'ci ci-pills', sequence: 1 },
      { value: 'eventGroup', name: 'Event Group', icon: 'ci ci-clipboard-medical', sequence: 2 },
    ],
  },
  {
    value: 'signaling',
    name: 'Signaling',
    icon: 'ci ci-chart-line',
    sequence: 4,
    scope: 'ORG',
    screens: [
      { value: 'alertConfiguration', name: 'Alert Configuration', icon: 'ci ci-bell', sequence: 1 },
    ],
  },
  {
    value: 'appSettings',
    name: 'App Settings',
    icon: 'ci ci-cog',
    sequence: 5,
    scope: 'ORG',
    screens: [
      { value: 'announcementManagement', name: 'Announcements', icon: 'ci ci-bell', sequence: 1 },
    ],
  },
];

/**
 * Upsert one permission row identified by its `value`. Returns the row's id.
 */
async function upsertPermission(
  manager: EntityManager,
  data: {
    value: string;
    name: string;
    parentId: string | null;
    icon?: string;
    sequence: number;
    scope: 'SYSTEM' | 'ORG';
  },
): Promise<string> {
  const repo = manager.getRepository(Permission);
  const existing = await repo.findOne({ where: { value: data.value } });
  if (existing) {
    // Refresh display fields in case the catalog evolved; leave id stable.
    existing.name = data.name;
    existing.parentId = data.parentId;
    existing.icon = data.icon ?? existing.icon ?? null;
    existing.sequence = data.sequence;
    existing.scope = data.scope;
    if (existing.status === 0) existing.status = 1;
    await repo.save(existing);
    return existing.id;
  }
  const created = repo.create({
    value: data.value,
    name: data.name,
    parentId: data.parentId,
    icon: data.icon ?? null,
    sequence: data.sequence,
    scope: data.scope,
    status: 1,
  });
  const saved = await repo.save(created);
  return saved.id;
}

const seedPermissionCatalog = async (
  manager: EntityManager,
): Promise<void> => {
  for (const mod of CATALOG) {
    // For "leaf-only" modules (no screens) we still create the module row
    // but it ALSO doubles as the grantable permission — `home` is one such
    // case. Convention: if `screens.length === 0`, the module row itself
    // is grantable (parent_id stays NULL).
    const moduleId = await upsertPermission(manager, {
      value: mod.value,
      name: mod.name,
      parentId: null,
      icon: mod.icon,
      sequence: mod.sequence,
      scope: mod.scope,
    });

    for (const scr of mod.screens) {
      await upsertPermission(manager, {
        value: scr.value,
        name: scr.name,
        parentId: moduleId,
        icon: scr.icon,
        sequence: scr.sequence,
        scope: mod.scope,
      });
    }
  }

  Logger.info('Permission catalog seeded / refreshed.');
};

export default seedPermissionCatalog;

/**
 * Helper for other seed code: get a permission's id by its `value`.
 * Throws if not found — catch this during seed to surface missing
 * catalog entries early.
 */
export async function getPermissionIdByValue(
  manager: EntityManager,
  value: string,
): Promise<string> {
  const repo = manager.getRepository(Permission);
  const row = await repo.findOne({ where: { value } });
  if (!row) {
    throw new Error(
      `seedPermissionCatalog: permission value "${value}" not found. ` +
        `Did you forget to add it to the catalog?`,
    );
  }
  return row.id;
}

/**
 * Helper for other seed code: get ALL permission ids that match a scope.
 * Used to grant Administrator FULL on every ORG permission, or System Admin
 * FULL on every SYSTEM permission.
 */
export async function getPermissionIdsByScope(
  manager: EntityManager,
  scope: 'SYSTEM' | 'ORG',
  options: { leavesOnly?: boolean } = {},
): Promise<{ id: string; value: string }[]> {
  const repo = manager.getRepository(Permission);
  const where: Record<string, unknown> = { scope, status: 1 };
  const rows = await repo.find({ where, order: { sequence: 'ASC' } });
  if (options.leavesOnly === false) return rows.map(r => ({ id: r.id, value: r.value }));

  // Default: leaves only (children of a module). If a module has no children
  // (like `home`), treat the module itself as a leaf.
  const byParent = new Map<string | null, typeof rows>();
  for (const r of rows) {
    const key = r.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(r);
  }
  const leaves: { id: string; value: string }[] = [];
  for (const r of rows) {
    const hasChildren = (byParent.get(r.id)?.length ?? 0) > 0;
    if (!hasChildren) leaves.push({ id: r.id, value: r.value });
  }
  return leaves;
}
