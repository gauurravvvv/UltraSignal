/**
 * Helpers for working with the permission tree shape.
 *
 * The tree shape is: `[{ id, parentId, label, value, level?, icon, subPermissions? }]`.
 * Parent (section header) nodes don't carry a `level` — only leaves do.
 */
import { ACCESS, AccessLevel } from './access';

export interface PermissionNode {
  id: number;
  parentId: string;
  label: string;
  value: string;
  icon?: string;
  level?: AccessLevel;
  subPermissions?: PermissionNode[];
}

/**
 * Deep-clone a permission template, stamping every leaf with `level`.
 * Parent nodes are left untouched (they get no level).
 *
 * Used to derive seed roles from the Administrator template:
 *   cloneTemplateWithLevel(CLIENT_ADMIN_PERMISSIONS, ACCESS.READ)  → Auditor
 *   cloneTemplateWithLevel(CLIENT_ADMIN_PERMISSIONS, ACCESS.NONE)  → empty role
 */
export function cloneTemplateWithLevel(
  template: PermissionNode[],
  level: AccessLevel,
): PermissionNode[] {
  return template.map((node) => stampLeaf(node, level));
}

function stampLeaf(node: PermissionNode, level: AccessLevel): PermissionNode {
  const cloned: PermissionNode = { ...node };
  if (node.subPermissions && node.subPermissions.length > 0) {
    cloned.subPermissions = node.subPermissions.map((c) => stampLeaf(c, level));
    // Parent nodes don't carry level.
    delete cloned.level;
  } else {
    cloned.level = level;
  }
  return cloned;
}

/**
 * Recursively find the level on a permission value in a tree.
 * Returns NONE if the value isn't found (which has the same meaning as
 * "permission is missing from the role").
 */
export function findLevel(
  tree: PermissionNode[],
  value: string,
): AccessLevel {
  for (const node of tree) {
    if (node.value === value) {
      return (node.level ?? ACCESS.NONE) as AccessLevel;
    }
    if (node.subPermissions && node.subPermissions.length > 0) {
      const found = findLevel(node.subPermissions, value);
      if (found > ACCESS.NONE) return found;
    }
  }
  return ACCESS.NONE;
}
