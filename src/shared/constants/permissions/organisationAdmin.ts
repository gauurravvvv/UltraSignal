/**
 * Source-of-truth permission tree for the per-org `Administrator` role.
 * Seeded into the per-org shared-DB `Role` table during org onboarding
 * (see `src/modules/orgs/controllers/addOrg.ts`); after that the DB row
 * is authoritative. Editing this file affects only newly-onboarded orgs.
 *
 * Login resolves permissions from `Role.permissions` and stamps them
 * into the JWT; `VerifyPermissionMiddleware` gates routes on those
 * values — no role-name bypass.
 */
export const ORG_ADMIN_PERMISSIONS = [
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
    label: 'User Management',
    value: 'orgManagement',
    status: true,
    icon: 'ci ci-site-map',
    subPermissions: [
      {
        id: 20,
        parentId: '2',
        label: 'Roles',
        value: 'roleManagement',
        status: true,
        icon: 'ci ci-shield-halved',
      },
      {
        id: 5,
        parentId: '2',
        label: 'User Groups',
        value: 'groupManagement',
        status: true,
        icon: 'ci ci-user-group',
      },
      {
        id: 3,
        parentId: '2',
        label: 'Users',
        value: 'userManagement',
        status: true,
        icon: 'ci ci-users',
      },
    ],
  },
  {
    id: 6,
    parentId: '0',
    label: 'Data Management',
    value: 'databaseManagement',
    status: true,
    icon: 'ci ci-layer-group',
    subPermissions: [
      {
        id: 7,
        parentId: '6',
        label: 'Data Source',
        value: 'setupDB',
        status: true,
        icon: 'ci ci-database',
      },
      {
        id: 8,
        parentId: '6',
        label: 'Connections',
        value: 'dbConnections',
        status: true,
        icon: 'ci ci-connection',
      },
      {
        id: 9,
        parentId: '6',
        label: 'Access Manager',
        value: 'accessManagement',
        status: true,
        icon: 'ci ci-access-manager',
      },
    ],
  },
  {
    id: 10,
    parentId: '0',
    label: 'DBExec Studio',
    value: 'dbExecStudio',
    status: true,
    icon: 'ci ci-studio',
    subPermissions: [
      {
        id: 11,
        parentId: '10',
        label: 'Tab',
        value: 'queryBuilderTab',
        status: true,
        icon: 'ci ci-ribbon',
      },
      {
        id: 12,
        parentId: '10',
        label: 'Section',
        value: 'queryBuilderSection',
        status: true,
        icon: 'ci ci-section',
      },
      {
        id: 13,
        parentId: '10',
        label: 'Prompt',
        value: 'queryBuilderPrompt',
        status: true,
        icon: 'ci ci-caret-down',
      },
      {
        id: 14,
        parentId: '10',
        label: 'Query Builder',
        value: 'queryBuilderScreen',
        status: true,
        icon: 'ci ci-screen',
      },
    ],
  },
  {
    id: 15,
    parentId: '0',
    label: 'Visualizations',
    value: 'visualizations',
    status: true,
    icon: 'ci ci-visualization',
    subPermissions: [
      {
        id: 16,
        parentId: '15',
        label: 'Dataset',
        value: 'datasetManager',
        status: true,
        icon: 'ci ci-dataset',
      },
      {
        id: 17,
        parentId: '15',
        label: 'Analyses',
        value: 'analyses',
        status: true,
        icon: 'ci ci-analyses',
      },
      {
        id: 18,
        parentId: '15',
        label: 'Dashboard',
        value: 'dashboard',
        status: true,
        icon: 'ci ci-dashboard',
      },
      {
        id: 19,
        parentId: '15',
        label: 'RLS Rules',
        value: 'rlsRules',
        status: true,
        icon: 'ci ci-shield-check',
      },
    ],
  },
  {
    id: 21,
    parentId: '0',
    label: 'App Settings',
    value: 'appSettings',
    status: true,
    icon: 'ci ci-cog',
    subPermissions: [
      {
        id: 22,
        parentId: '21',
        label: 'Announcements',
        value: 'announcementManagement',
        status: true,
        icon: 'ci ci-bell',
      },
    ],
  },
];
