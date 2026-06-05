/**
 * SYSTEM_ADMIN_PERMISSIONS_V2 — what the platform operator can do.
 *
 * This constant is the one-time seed source for the master-DB
 * `Role` row (see `seedSystemAdminRole.ts`). After first boot the
 * source of truth is the DB; this file is for reference + future
 * re-seeds.
 *
 * Permissions:
 *   - home              — landing page
 *   - systemManagement  — section header for the two below
 *   - systemAdmin       — manage other system admin users
 *   - clientManagement  — onboard / list / edit / delete clients
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
        label: 'Clients',
        value: 'clientManagement',
        icon: 'ci ci-building',
        status: true,
      },
    ],
  },
];
