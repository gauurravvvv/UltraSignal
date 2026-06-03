import { DataSource } from 'typeorm';
import { UserGroupMapping } from '../db/entities/user-group-mapping.entity';
import { mergePermissions } from './mergePermissions';

interface ResolvedPermissions {
  permissions: any[];
  roleName: string;
  groupNames: string[];
  roleNames: string[];
}

/**
 * Resolve a user's effective permissions by merging all group roles.
 */
export async function resolveUserPermissions(
  connection: DataSource,
  userId: string,
): Promise<ResolvedPermissions> {
  const mappings = await connection
    .getRepository(UserGroupMapping)
    .createQueryBuilder('m')
    .innerJoinAndSelect('m.group', 'g')
    .innerJoinAndSelect('g.role', 'r')
    .where('m.userId = :userId', { userId })
    .andWhere('g.status = :gActive', { gActive: '1' })
    .andWhere('r.status = :rActive', { rActive: '1' })
    .getMany();

  if (mappings.length === 0) {
    return { permissions: [], roleName: '', groupNames: [], roleNames: [] };
  }

  const rolePermissionJsons: string[] = [];
  const groupNames: string[] = [];
  const roleNames: string[] = [];
  const seenRoles = new Set<string>();

  for (const m of mappings) {
    groupNames.push(m.group.name);
    if (!seenRoles.has(m.group.role.id)) {
      seenRoles.add(m.group.role.id);
      roleNames.push(m.group.role.name);
      rolePermissionJsons.push(m.group.role.permissions);
    }
  }

  const permissions = mergePermissions(rolePermissionJsons);

  // Effective role name: prefer "Administrator" if present, else first role
  const roleName = roleNames.includes('Administrator')
    ? 'Administrator'
    : roleNames[0] || '';

  return { permissions, roleName, groupNames, roleNames };
}
