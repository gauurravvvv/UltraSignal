/**
 * Source-of-truth permission tree for the per-org `Member` role. Seeded
 * into the per-org shared-DB `Role` table during org onboarding (see
 * `src/modules/orgs/controllers/addOrg.ts`); after that the DB row is
 * authoritative. Editing this file affects only newly-onboarded orgs.
 *
 * Login resolves permissions from `Role.permissions` and stamps them
 * into the JWT; `VerifyPermissionMiddleware` gates routes on those
 * values — no role-name bypass.
 */
export const ORG_USER_PERMISSIONS = [
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
    label: 'DBExec Studio',
    value: 'dbExecStudio',
    status: true,
    icon: 'ci ci-studio',
    subPermissions: [
      {
        id: 3,
        parentId: '2',
        label: 'Tab',
        value: 'queryBuilderTab',
        status: true,
        icon: 'ci ci-ribbon',
      },
      {
        id: 4,
        parentId: '2',
        label: 'Section',
        value: 'queryBuilderSection',
        status: true,
        icon: 'ci ci-section',
      },
      {
        id: 5,
        parentId: '2',
        label: 'Prompt',
        value: 'queryBuilderPrompt',
        status: true,
        icon: 'ci ci-caret-down',
      },
      {
        id: 6,
        parentId: '2',
        label: 'Query Builder',
        value: 'queryBuilderScreen',
        status: true,
        icon: 'ci ci-screen',
      },
    ],
  },
  {
    id: 7,
    parentId: '0',
    label: 'Visualizations',
    value: 'visualizations',
    status: true,
    icon: 'ci ci-visualization',
    subPermissions: [
      {
        id: 8,
        parentId: '7',
        label: 'Dataset',
        value: 'datasetManager',
        status: true,
        icon: 'ci ci-dataset',
      },
      {
        id: 9,
        parentId: '7',
        label: 'Analyses',
        value: 'analyses',
        status: true,
        icon: 'ci ci-analyses',
      },
      {
        id: 10,
        parentId: '7',
        label: 'Dashboard',
        value: 'dashboard',
        status: true,
        icon: 'ci ci-dashboard',
      },
    ],
  },
];
