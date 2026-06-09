/**
 * buildSessionBootstrap — assembles the phase-2 "session-ready"
 * payload for GET /api/v1/auth/session.
 *
 * Inputs:
 *  - user: an already-authenticated User row (caller is responsible
 *    for credential verification and account-state checks before
 *    handing the user here).
 *  - client: the Client row with `config` relation loaded.
 *
 * Output mirrors the FE Relay/session contract so the Relay component
 * stays portable. `theme` and `branding` are returned as `null` and
 * `announcements` as `[]` because UltraSignal does not yet ship
 * those modules — placeholders so the FE shape is forward-compatible.
 *
 * The `permissions` field is a TREE — top-level modules with their
 * granted child screens nested underneath. Built from:
 *   1. The flat { value, level } list resolved via group → role → mapping
 *   2. The permission catalog (parent_id walks)
 * and ordered by `sequence` at every level so the FE renders in the
 * same order as the catalog.
 *
 * Errors propagate to the caller (getSession), which decides how to
 * respond to the client.
 */
import { Client } from '../../db/entities/client.entity';
import { Permission } from '../../db/entities/permission.entity';
import { User } from '../../db/entities/user.entity';
import { AppDataSource } from '../../db';
import {
  resolveUserPermissions,
  ResolvedPermission,
} from '../../utility/resolveUserPermissions';
import { sanitiseUser } from '../../utility/sanitiseUser';

interface PermissionNode {
  id: string;
  value: string;
  name: string;
  icon: string | null;
  sequence: number;
  scope: 'SYSTEM' | 'ORG';
  /** Set on every node EXCEPT pure section-parents that have at least
   *  one granted child. A leaf-only module (e.g. `home`) carries level. */
  level?: number;
  children: PermissionNode[];
}

export interface SessionBootstrap {
  user: Record<string, unknown>;
  permissions: PermissionNode[];
  role: string;
  sessionInactivityTimeout: number;
  theme: null;
  branding: null;
  announcements: unknown[];
}

/**
 * Build the parent → children tree from the flat granted list.
 *
 *   1. Index the catalog by value (for lookup) and by id (for parent walk).
 *   2. For each granted permission:
 *        - if catalog row has parent_id, attach it as a child of that parent
 *        - else (top-level leaf module like `home`), surface it at the root
 *   3. Sort root + children by `sequence`.
 */
function buildPermissionTree(
  granted: ResolvedPermission[],
  catalog: Permission[],
): PermissionNode[] {
  const byId = new Map<string, Permission>();
  const byValue = new Map<string, Permission>();
  for (const p of catalog) {
    byId.set(p.id, p);
    byValue.set(p.value, p);
  }

  // Track which parent modules we've already pulled into the tree so we
  // don't add them twice when two children belong to the same parent.
  const parentNodes = new Map<string, PermissionNode>();
  const rootNodes: PermissionNode[] = [];

  const toNode = (p: Permission, level?: number): PermissionNode => ({
    id: p.id,
    value: p.value,
    name: p.name,
    icon: p.icon ?? null,
    sequence: p.sequence,
    scope: p.scope,
    ...(level !== undefined ? { level } : {}),
    children: [],
  });

  for (const grant of granted) {
    const perm = byValue.get(grant.value);
    if (!perm) continue; // catalog out of sync; skip silently

    if (perm.parentId === null) {
      // Top-level leaf module (e.g. `home`) — appears at root with level.
      rootNodes.push(toNode(perm, grant.level));
      continue;
    }

    // Nested screen under a parent module. Reuse the parent node if we
    // already created it for an earlier sibling.
    const parent = byId.get(perm.parentId);
    if (!parent) continue;

    let parentNode = parentNodes.get(parent.id);
    if (!parentNode) {
      parentNode = toNode(parent); // no level on pure section parents
      parentNodes.set(parent.id, parentNode);
      rootNodes.push(parentNode);
    }
    parentNode.children.push(toNode(perm, grant.level));
  }

  // Sort every level by `sequence` ascending.
  rootNodes.sort((a, b) => a.sequence - b.sequence);
  for (const node of rootNodes) {
    node.children.sort((a, b) => a.sequence - b.sequence);
  }
  return rootNodes;
}

export async function buildSessionBootstrap(
  user: User,
  client: Client,
): Promise<SessionBootstrap> {
  const resolved = await resolveUserPermissions(AppDataSource, user.id);

  // Load the active permission catalog once to enrich the flat granted
  // list with parent-child structure + display metadata.
  const catalog = await AppDataSource.getRepository(Permission).find({
    where: { status: 1 },
  });

  const permissions = buildPermissionTree(resolved.permissions, catalog);

  return {
    user: sanitiseUser(user),
    permissions,
    role: resolved.roleName,
    sessionInactivityTimeout: client.config?.sessionInactivityTimeout || 30,
    theme: null,
    branding: null,
    announcements: [],
  };
}
