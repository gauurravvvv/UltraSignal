/**
 * Legacy full System Admin permission tree. Kept for reference and as a
 * rollback target — NOT active at runtime.
 *
 * The platform-level System Admin role is now seeded from `systemAdminV2.ts`
 * (a trimmed set covering client management + system admin housekeeping +
 * audit + app settings) into the master-DB `Role` table on first boot.
 * Login reads `Role.permissions` and stamps it into the JWT;
 * `VerifyPermissionMiddleware` gates routes on those values, with no
 * role-name bypass for SYSTEM-ADMIN.
 *
 * TODO: once we are confident the V2 set covers every operational need,
 * delete this file and the role-string fallback paths in login.ts /
 * onboardDB.ts that still touch it.
 */
export const SYSTEM_ADMIN_PERMISSIONS = [
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
        label: 'Clients',
        value: 'clientManagement',
        icon: 'ci ci-building',
        status: true,
      },
    ],
  },
  {
    id: 5,
    parentId: '0',
    label: 'User Management',
    value: 'userMgmtSection',
    status: true,
    icon: 'ci ci-site-map',
    subPermissions: [
      {
        id: 6,
        parentId: '5',
        label: 'Roles',
        value: 'roleManagement',
        status: true,
        icon: 'ci ci-shield-halved',
      },
      {
        id: 7,
        parentId: '5',
        label: 'Groups',
        value: 'groupManagement',
        status: true,
        icon: 'ci ci-user-group',
      },
      {
        id: 8,
        parentId: '5',
        label: 'Users',
        value: 'userManagement',
        status: true,
        icon: 'ci ci-users',
      },
    ],
  },
  {
    id: 9,
    parentId: '0',
    label: 'Data Management',
    value: 'databaseManagement',
    status: true,
    icon: 'ci ci-layer-group',
    subPermissions: [
      {
        id: 10,
        parentId: '9',
        label: 'Data Source',
        value: 'setupDB',
        status: true,
        icon: 'ci ci-database',
      },
      {
        id: 11,
        parentId: '9',
        label: 'Connections',
        value: 'dbConnections',
        status: true,
        icon: 'ci ci-connection',
      },
      {
        id: 12,
        parentId: '9',
        label: 'Access Manager',
        value: 'accessManagement',
        status: true,
        icon: 'ci ci-access-manager',
      },
    ],
  },
  {
    id: 13,
    parentId: '0',
    label: 'DBExec Studio',
    value: 'dbExecStudio',
    status: true,
    icon: 'ci ci-studio',
    subPermissions: [
      {
        id: 14,
        parentId: '13',
        label: 'Tab',
        value: 'queryBuilderTab',
        status: true,
        icon: 'ci ci-ribbon',
      },
      {
        id: 15,
        parentId: '13',
        label: 'Section',
        value: 'queryBuilderSection',
        status: true,
        icon: 'ci ci-section',
      },
      {
        id: 16,
        parentId: '13',
        label: 'Prompt',
        value: 'queryBuilderPrompt',
        status: true,
        icon: 'ci ci-caret-down',
      },
      {
        id: 17,
        parentId: '13',
        label: 'Query Builder',
        value: 'queryBuilderScreen',
        status: true,
        icon: 'ci ci-screen',
      },
    ],
  },
  {
    id: 18,
    parentId: '0',
    label: 'Visualizations',
    value: 'visualizations',
    status: true,
    icon: 'ci ci-visualization',
    subPermissions: [
      {
        id: 19,
        parentId: '18',
        label: 'Dataset',
        value: 'datasetManager',
        status: true,
        icon: 'ci ci-dataset',
      },
      {
        id: 20,
        parentId: '18',
        label: 'Analyses',
        value: 'analyses',
        status: true,
        icon: 'ci ci-analyses',
      },
      {
        id: 21,
        parentId: '18',
        label: 'Dashboard',
        value: 'dashboard',
        status: true,
        icon: 'ci ci-dashboard',
      },
      {
        id: 25,
        parentId: '18',
        label: 'RLS Rules',
        value: 'rlsRules',
        status: true,
        icon: 'ci ci-shield-check',
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
