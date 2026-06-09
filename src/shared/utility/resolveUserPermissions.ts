/**
 * resolveUserPermissions — produces a user's effective permission set by
 * walking the RBAC tables in one SQL query.
 *
 *   user
 *     → user_group_mapping
 *       → group
 *         → role
 *           → role_permission_mapping
 *             → permission
 *
 * For each permission `value` the user touches via any of their groups,
 * the query takes MAX(level). That GROUP BY is the entire "merge across
 * groups" logic — no JSON parsing, no per-role tree walks.
 *
 * Output:
 *   - permissions: flat array of { value, level }, the source of truth
 *                  for the JWT and the FE
 *   - roleName:    the user's "effective" role label (Administrator if
 *                  any group carries it, else the first role name)
 *   - groupNames / roleNames: for display
 */
import { DataSource } from 'typeorm';

export interface ResolvedPermission {
  value: string;
  level: number;
}

interface ResolvedPermissions {
  permissions: ResolvedPermission[];
  roleName: string;
  groupNames: string[];
  roleNames: string[];
}

export async function resolveUserPermissions(
  connection: DataSource,
  userId: string,
): Promise<ResolvedPermissions> {
  // Merged permission set — one MAX(level) per permission value.
  const permRows: { value: string; level: number | string }[] =
    await connection.query(
      `
      SELECT p.value          AS value,
             MAX(rpm.level)   AS level
      FROM   user_group_mapping ugm
      JOIN   "group" g                    ON g.id = ugm."groupId"
      JOIN   role r                       ON r.id = g."roleId"
      JOIN   role_permission_mapping rpm  ON rpm."roleId" = r.id
      JOIN   permission p                 ON p.id = rpm."permissionId"
      WHERE  ugm."userId" = $1
        AND  g.status = 1
        AND  r.status = 1
        AND  p.status = 1
      GROUP  BY p.value
      `,
      [userId],
    );

  // Display-only metadata — group and role names. Small result set so a
  // second query is fine.
  const meta: { groupName: string; roleName: string }[] = await connection.query(
    `
    SELECT g.name AS "groupName",
           r.name AS "roleName"
    FROM   user_group_mapping ugm
    JOIN   "group" g  ON g.id = ugm."groupId"
    JOIN   role r     ON r.id = g."roleId"
    WHERE  ugm."userId" = $1
      AND  g.status = 1
      AND  r.status = 1
    `,
    [userId],
  );

  const permissions: ResolvedPermission[] = permRows.map(r => ({
    value: r.value,
    level: Number(r.level),
  }));

  const groupNames = Array.from(new Set(meta.map(m => m.groupName)));
  const roleNames = Array.from(new Set(meta.map(m => m.roleName)));

  // Effective role label: prefer "Administrator" if any group carries it.
  const roleName = roleNames.includes('Administrator')
    ? 'Administrator'
    : roleNames[0] || '';

  return { permissions, roleName, groupNames, roleNames };
}
