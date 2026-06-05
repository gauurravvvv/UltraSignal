/**
 * Source-of-truth permission tree for the per-client `Administrator` role.
 * Seeded into the per-client shared-DB `Role` table during client onboarding
 * (see `src/modules/clients/controllers/addClient.ts`); after that the DB row
 * is authoritative. Editing this file affects only newly-onboarded clients.
 *
 * Login resolves permissions from `Role.permissions` and stamps them
 * into the JWT; `VerifyPermissionMiddleware` gates routes on those
 * values — no role-name bypass.
 */
export const CLIENT_ADMIN_PERMISSIONS = [
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
    value: 'clientManagement',
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
];
