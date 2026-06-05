/**
 * Source-of-truth permission tree for the per-client `Member` role. Seeded
 * into the per-client shared-DB `Role` table during client onboarding (see
 * `src/modules/clients/controllers/addClient.ts`); after that the DB row is
 * authoritative. Editing this file affects only newly-onboarded clients.
 *
 * Login resolves permissions from `Role.permissions` and stamps them
 * into the JWT; `VerifyPermissionMiddleware` gates routes on those
 * values — no role-name bypass.
 */
export const CLIENT_USER_PERMISSIONS = [
  {
    id: 1,
    parentId: '0',
    label: 'Home',
    value: 'home',
    status: true,
    icon: 'ci ci-home',
  },
];
