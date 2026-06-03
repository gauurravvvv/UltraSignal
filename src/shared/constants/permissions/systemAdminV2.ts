/**
 * SYSTEM_ADMIN_PERMISSIONS_V2 — what the platform operator can do
 * after the role-lockdown refactor.
 *
 * Previously (`systemAdmin.ts`), system admins had implicit full
 * access because `VerifyPermissionMiddleware` bypassed the check
 * for `loggedInRole === SYSTEM_ADMIN`. That bypass is removed; the
 * permissions a system admin actually carries are now exactly
 * what this constant lists.
 *
 * Stripped from the previous V1 set:
 *   - userMgmtSection (roleManagement, groupManagement, userManagement)
 *   - databaseManagement (setupDB, dbConnections, accessManagement)
 *   - dbExecStudio (queryBuilderTab/Section/Prompt/Screen)
 *   - visualizations (datasetManager, analyses, dashboard, rlsRules)
 *
 * Those all live INSIDE an organisation. The system admin is a
 * platform operator, not a member of any organisation's data
 * plane, so they have no business CRUD'ing those resources.
 *
 * What stays:
 *   - home                  — landing page
 *   - systemManagement      — section header for the two below
 *   - systemAdmin           — manage other system admin users
 *   - orgManagement         — onboard / list / edit / delete orgs
 *   - auditActivity         — section header
 *   - auditLogs             — cross-org audit (already attribution-
 *                             masked via SYSTEM_ADMIN_SENTINEL_ID)
 *   - loginActivity         — cross-org login history
 *   - appSettings           — section header
 *   - announcementManagement — cross-org announcements
 *
 * IDs are preserved from V1 where the permission survives so any
 * FE that keyed off `id` stays compatible. The dropped IDs (5-21,
 * 25) leave gaps — that's intentional and harmless; the FE only
 * cares about `value` for permission lookups.
 *
 * This constant is the one-time seed source for the master-DB
 * `Role` row (see `seedSystemAdminRole.ts`). After first boot the
 * source of truth is the DB; this file is for reference + future
 * re-seeds.
 */
export const SYSTEM_ADMIN_PERMISSIONS_V2 = [
  {
    id: 1,
    parentId: '0',
    label: 'Home',
    value: 'home',
    status: true,
    icon: 'ci ci-home',
  },
  {
    id: 2,
    parentId: '0',
    label: 'System Management',
    value: 'systemManagement',
    status: true,
    icon: 'ci ci-user-cong',
    subPermissions: [
      {
        id: 3,
        parentId: '2',
        label: 'System Admin',
        value: 'systemAdmin',
        status: true,
        icon: 'ci ci-user-gear',
      },
      {
        id: 4,
        parentId: '2',
        label: 'Organisations',
        value: 'orgManagement',
        icon: 'ci ci-building',
        status: true,
      },
    ],
  },
  {
    id: 22,
    parentId: '0',
    label: 'Audit & Activity',
    value: 'auditActivity',
    status: true,
    icon: 'ci ci-clipboard-list',
    subPermissions: [
      {
        id: 23,
        parentId: '22',
        label: 'Audit Logs',
        value: 'auditLogs',
        status: true,
        icon: 'ci ci-audit-logs',
      },
      {
        id: 24,
        parentId: '22',
        label: 'Login Activity',
        value: 'loginActivity',
        status: true,
        icon: 'ci ci-login-activity',
      },
    ],
  },
  {
    id: 26,
    parentId: '0',
    label: 'App Settings',
    value: 'appSettings',
    status: true,
    icon: 'ci ci-cog',
    subPermissions: [
      {
        id: 27,
        parentId: '26',
        label: 'Announcements',
        value: 'announcementManagement',
        status: true,
        icon: 'ci ci-bell',
      },
    ],
  },
];
