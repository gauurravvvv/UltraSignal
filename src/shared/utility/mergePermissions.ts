/**
 * Merge permission trees from multiple roles.
 *
 * The DB stores each role's permission tree as its own JSON blob —
 * System Admin, Administrator, Member, etc. all carry their own shape,
 * label, and icon set. The merge contract is:
 *
 *   - Single role  → return that role's tree verbatim (filtering out
 *                     status: false nodes for safety).
 *   - Multiple roles → union by `value`. Each node appears once in the
 *                     output; the FIRST role that contributes a given
 *                     `value` wins for label / icon / order. Children
 *                     merge recursively with the same rule.
 *
 * `status: false` nodes are dropped at every level — those exist as
 * "registered but disabled" entries in the seed file and should never
 * leak to the FE.
 *
 * Prior versions of this file hardcoded CLIENT_ADMIN_PERMISSIONS as the
 * canonical structure, which silently swapped a System Admin's
 * "System Management → System Admin / Clients" tree for the org
 * admin's "User Management → Roles / Groups / Users" tree whenever
 * value strings collided. Bug surfaced as wrong labels in /session.
 */

interface PermNode {
  id?: number | string;
  parentId?: string;
  label?: string;
  value: string;
  status?: boolean;
  icon?: string;
  subPermissions?: PermNode[];
  [key: string]: any;
}

/** Recursively strip `status: false` nodes. Leaves the rest untouched. */
function stripDisabled(tree: PermNode[]): PermNode[] {
  const out: PermNode[] = [];
  for (const n of tree) {
    if (n.status === false) continue;
    const children = n.subPermissions
      ? stripDisabled(n.subPermissions)
      : undefined;
    out.push({
      ...n,
      // Drop subPermissions key entirely when there are none, so the
      // FE sees the same shape it would for a real leaf.
      ...(children && children.length > 0
        ? { subPermissions: children }
        : { subPermissions: undefined }),
    });
  }
  return out;
}

/**
 * Union two permission trees by `value`. The first occurrence of a
 * value wins for non-children fields; children recurse with the same
 * rule.
 */
function unionTrees(a: PermNode[], b: PermNode[]): PermNode[] {
  const byValue = new Map<string, PermNode>();
  const order: string[] = [];

  const visit = (tree: PermNode[]) => {
    for (const n of tree) {
      const existing = byValue.get(n.value);
      if (!existing) {
        byValue.set(n.value, { ...n });
        order.push(n.value);
      } else if (n.subPermissions && existing.subPermissions) {
        existing.subPermissions = unionTrees(
          existing.subPermissions,
          n.subPermissions,
        );
      } else if (n.subPermissions && !existing.subPermissions) {
        // First role had this as a leaf; later role brings children.
        // Promote to a branch so the union doesn't lose them.
        existing.subPermissions = [...n.subPermissions];
      }
      // If both have no children OR existing already has children and
      // the new one is a leaf, keep existing as-is.
    }
  };

  visit(a);
  visit(b);

  return order.map(v => byValue.get(v)!);
}

export function mergePermissions(rolePermissionJsons: string[]): PermNode[] {
  const trees: PermNode[][] = [];

  for (const json of rolePermissionJsons) {
    if (!json) continue;
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) {
        trees.push(stripDisabled(parsed as PermNode[]));
      }
    } catch {
      // Skip malformed JSON — one bad row shouldn't break login.
    }
  }

  if (trees.length === 0) return [];
  if (trees.length === 1) return trees[0];

  return trees.reduce((acc, next) => unionTrees(acc, next), [] as PermNode[]);
}
