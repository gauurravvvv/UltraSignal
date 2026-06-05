import { CLIENT_ADMIN_PERMISSIONS } from '../constants/permissions/clientAdmin.permission';

/**
 * Flatten all permission `value` strings from a permission tree.
 */
function flattenValues(perms: any[]): Set<string> {
  const values = new Set<string>();
  for (const p of perms) {
    if (p.status !== false) values.add(p.value);
    if (p.subPermissions) {
      for (const v of flattenValues(p.subPermissions)) {
        values.add(v);
      }
    }
  }
  return values;
}

/**
 * Build a permission tree keeping only nodes whose value is in `activeValues`
 * (or that have active children). Uses CLIENT_ADMIN_PERMISSIONS as the canonical structure.
 */
function buildMergedTree(template: any[], activeValues: Set<string>): any[] {
  const result: any[] = [];
  for (const perm of template) {
    const children = perm.subPermissions
      ? buildMergedTree(perm.subPermissions, activeValues)
      : undefined;

    const hasActiveChildren = children && children.length > 0;
    const isActive = activeValues.has(perm.value);

    if (isActive || hasActiveChildren) {
      result.push({
        ...perm,
        status: true,
        subPermissions: hasActiveChildren ? children : undefined,
      });
    }
  }
  return result;
}

/**
 * Merge permission trees from multiple roles.
 * Union semantics: if ANY role has a permission with status=true, user gets it.
 *
 * @param rolePermissionJsons - array of JSON-stringified permission arrays (one per role)
 * @returns merged permission tree
 */
export function mergePermissions(rolePermissionJsons: string[]): any[] {
  const allValues = new Set<string>();

  for (const json of rolePermissionJsons) {
    try {
      const tree = JSON.parse(json);
      for (const v of flattenValues(tree)) {
        allValues.add(v);
      }
    } catch {
      // Skip malformed JSON
    }
  }

  if (allValues.size === 0) return [];

  return buildMergedTree(CLIENT_ADMIN_PERMISSIONS, allValues);
}
