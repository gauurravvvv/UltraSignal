/**
 * Permission access levels — the canonical scale used by the
 * permission tree, the merge logic, and the route middleware.
 *
 *   NONE  → screen does not exist for this user; sidebar hidden, route 401
 *   READ  → can view list & details; cannot create / edit / delete
 *   WRITE → can create + edit; cannot delete or perform full-control actions
 *   FULL  → full control (delete, bulk-delete, admin actions like unlock /
 *           password-reset, etc.)
 *
 * Higher level implies all lower levels (FULL >= WRITE >= READ).
 *
 * Numeric so comparisons stay one-liner (`userLevel >= ACCESS.WRITE`) and
 * MAX(...) merging across groups is trivial.
 */
export const ACCESS = {
  NONE: 0,
  READ: 1,
  WRITE: 2,
  FULL: 3,
} as const;

export type AccessLevel = (typeof ACCESS)[keyof typeof ACCESS];

/**
 * Human label for a level — used only for logs / debugging.
 */
export const ACCESS_LABEL: Record<AccessLevel, string> = {
  [ACCESS.NONE]: 'None',
  [ACCESS.READ]: 'Read',
  [ACCESS.WRITE]: 'Write',
  [ACCESS.FULL]: 'Full',
};
