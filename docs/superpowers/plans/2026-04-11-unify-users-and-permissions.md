# Unify Users Module & Permission-Based Access Control

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge org-admin into users module, replace role-name access checks with permission-based checks, fix list-permissions API, and modernize role module UI.

**Architecture:** Remove the separate org-admin BE/FE modules entirely. The unified `/user/*` API handles ALL org users (both ORG-ADMIN and ORG-USER). Access is gated by `VerifyPermissionMiddleware` on routes — no more role-name checks in validation middleware. The `role` field on User entity remains for system-level distinction (login flow, audit module naming) but is no longer used for access control.

**Tech Stack:** Express + TypeORM (BE), Angular + PrimeNG (FE)

---

## Phase 1: Backend Quick Fixes

### Task 1: Fix list-permissions API (no DB connection needed)

**Files:**

- Modify: `UltraSignal-API/src/routes/role.routes.ts:67-75`
- Modify: `UltraSignal-API/src/controllers/role/listPermissions.ts`

The `listPermissions` controller only returns `res.locals.permissions` (from JWT). It never queries the DB, yet `VerifyMasterDatabaseMiddleware` opens a connection just to have it closed. The FE also doesn't send `orgId`, which `VerifyMasterDatabaseMiddleware` requires — so this endpoint is currently **broken** for non-super-admin users.

- [ ] **Step 1: Remove VerifyMasterDatabaseMiddleware from permissions route**

```typescript
// role.routes.ts — change the permissions route to:
router.get(
  '/permissions',
  AuthMiddleware,
  VerifyPermissionMiddleware('roleManagement'),
  VerifyResourceMiddleware,
  ListPermissionsValidation,
  roleController.permissions,
);
```

Remove `VerifyMasterDatabaseMiddleware` from the import if no other route in this file uses it (all other routes do, so keep the import).

- [ ] **Step 2: Update controller to not reference master_db_connection**

```typescript
// listPermissions.ts
const listPermissions = async (req: Request, res: Response) => {
  Logger.info('List Permissions request');
  const { permissions } = res.locals;
  sendResponse(res, true, CODE.SUCCESS, ROLE_MSG.PERMISSIONS_FETCHED, {
    permissions: permissions || [],
  });
};
```

- [ ] **Step 3: Remove role-name check from ListPermissionsValidation**

Since `VerifyPermissionMiddleware('roleManagement')` already handles access control:

```typescript
// listPermissions.validation.ts — simplify to just call next()
const ListPermissionsValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  next();
};
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit`

---

### Task 2: Remove role-name access checks from ALL validation middleware

**Rationale:** Every route now has `VerifyPermissionMiddleware('{permission}')` which checks the JWT permissions tree. The old `if (loggedInRole === ROLES.ORG_USER) return UNAUTHORIZED` checks are redundant.

**Pattern to apply to every file listed below:**

- Remove the `if (loggedInRole === ROLES.ORG_USER)` or `if (loggedInRole !== ROLES.SYSTEM_ADMIN && loggedInRole !== ROLES.ORG_ADMIN)` check
- Remove unused `ROLES` import if no longer needed
- Remove unused `loggedInRole` destructuring if no longer needed

**Files (validation middleware):**

- Modify: `middleware/user/addUser.validation.ts` — remove line 29-31 ORG_USER check
- Modify: `middleware/user/updateUser.validation.ts` — remove line 33-35 ORG_USER check
- Modify: `middleware/user/getUser.validation.ts` — remove line 20-22 ORG_USER check
- Modify: `middleware/user/listUser.validation.ts` — remove entire ORG_USER check (simplify to just `next()`)
- Modify: `middleware/user/deleteUser.validation.ts` — remove line 19 ORG_ADMIN check
- Modify: `middleware/user/updatePassword.validation.ts` — remove line 28-30 ORG_USER check
- Modify: `middleware/orgAdmin/listAdmin.validation.ts` — (will be deleted in Task 5)
- Modify: `middleware/orgAdmin/deleteAdmin.validation.ts` — (will be deleted in Task 5)
- Modify: `middleware/orgAdmin/updatePassword.validation.ts` — (will be deleted in Task 5)
- Modify: `middleware/orgAdmin/addAdmin.validation.ts` — (will be deleted in Task 5)
- Modify: `middleware/orgAdmin/updateAdmin.validation.ts` — (will be deleted in Task 5)
- Modify: `middleware/orgAdmin/getAdmin.validation.ts` — (will be deleted in Task 5)
- Modify: `middleware/datasource/addDatasource.validation.ts` — remove ORG_USER check
- Modify: `middleware/datasource/getDatasource.validation.ts` — remove ORG_USER check
- Modify: `middleware/datasource/updateDatasource.validation.ts` — remove ORG_USER check
- Modify: `middleware/datasource/deleteDatasource.validation.ts` — remove ORG_USER check
- Modify: `middleware/datasource/validateDatasource.validation.ts` — remove ORG_USER check
- Modify: `middleware/datasource/activity/refreshActivity.validation.ts` — remove ORG_USER check
- Modify: `middleware/datasource/activity/cancelQuery.validation.ts` — remove ORG_USER check
- Modify: `middleware/datasource/activity/terminateConnection.validation.ts` — remove ORG_USER check
- Modify: `middleware/group/addGroup.validation.ts` — remove ORG_USER check
- Modify: `middleware/group/getGroup.validation.ts` — remove ORG_USER check
- Modify: `middleware/group/updateGroup.validation.ts` — remove ORG_USER check
- Modify: `middleware/group/deleteGroup.validation.ts` — remove ORG_USER check
- Modify: `middleware/dataset/addDataset.validation.ts` — remove ORG_USER check
- Modify: `middleware/dataset/getDataset.validation.ts` — remove ORG_USER check
- Modify: `middleware/dataset/updateDataset.validation.ts` — remove ORG_USER check
- Modify: `middleware/dataset/deleteDataset.validation.ts` — remove ORG_USER check
- Modify: `middleware/dataset/addDatasetField.validation.ts` — remove ORG_USER check
- Modify: `middleware/dataset/updateDatasetField.validation.ts` — remove ORG_USER check
- Modify: `middleware/dataset/addDatasetViaBuilder.validation.ts` — remove ORG_USER check
- Modify: `middleware/dataset/updateDatasetViaBuilder.validation.ts` — remove ORG_USER check
- Modify: `middleware/dataset/duplicateDataset.validation.ts` — remove ORG_USER check
- Modify: `middleware/access/getAccessDetails.middleware.ts` — remove ORG_USER check
- Modify: `middleware/access/grantAccess.middleware.ts` — remove ORG_USER check
- Modify: `middleware/role/addRole.validation.ts` — remove ORG_USER check
- Modify: `middleware/role/getRole.validation.ts` — remove ORG_USER check
- Modify: `middleware/role/updateRole.validation.ts` — remove ORG_USER check
- Modify: `middleware/role/deleteRole.validation.ts` — remove ORG_USER check
- Modify: `middleware/role/listRole.validation.ts` — remove ORG_USER check
- Modify: `middleware/section/addSection.validation.ts` — remove ORG_USER check
- Modify: `middleware/section/getSection.validation.ts` — remove ORG_USER check
- Modify: `middleware/section/updateSection.validation.ts` — remove ORG_USER check
- Modify: `middleware/section/deleteSection.validation.ts` — remove ORG_USER check
- Modify: `middleware/section/listSection.validation.ts` — remove ORG_USER check
- Modify: `middleware/section/getSectionPrompts.validation.ts` — remove ORG_USER check
- Modify: `middleware/auditLog/listAuditLog.validation.ts` — remove ORG_ADMIN/SYSTEM_ADMIN check
- Modify: `middleware/auditLog/listLoginActivity.validation.ts` — remove ORG_ADMIN/SYSTEM_ADMIN check
- Modify: `middleware/connections/listConnection.validation.ts` — remove inverse ORG_USER check
- Modify: `middleware/dataset/listDataset.validation.ts` — remove inverse ORG_USER check
- Modify: `middleware/group/listGroupvalidation.ts` — remove inverse ORG_USER check
- Modify: `middleware/announcement/configAnnouncement.validation.ts` — remove ORG_ADMIN type restriction

**Special cases — list validations that currently check `if ORG_USER { deny } else { next() }`:**
These become simple pass-through since VerifyPermissionMiddleware handles access:

```typescript
const ListValidation = (req: Request, res: Response, next: NextFunction) => {
  next();
};
```

**Special cases — `listConnection.validation.ts`, `listDataset.validation.ts`, `listGroupvalidation.ts`:**
These have the INVERSE pattern: `if (loggedInRole !== ROLES.ORG_USER) { next() }`. Since permissions now gate access, remove the role check and just call `next()` (or keep the actual validation logic that follows the role check).

- [ ] **Step 1:** Apply the pattern to all user/\* middleware files (6 files)
- [ ] **Step 2:** Apply to all datasource/\* middleware files (8 files)
- [ ] **Step 3:** Apply to all group/\* middleware files (4 files)
- [ ] **Step 4:** Apply to all dataset/\* middleware files (9 files)
- [ ] **Step 5:** Apply to all role/\* middleware files (5 files)
- [ ] **Step 6:** Apply to all section/\* middleware files (6 files)
- [ ] **Step 7:** Apply to access/_, auditLog/_, connections/_, announcement/_ middleware files
- [ ] **Step 8: Verify** — `npx tsc --noEmit`

---

## Phase 2: Merge Org-Admin into Users (Backend)

### Task 3: Update user controllers to handle ALL org users

**Files:**

- Modify: `controllers/user/listUser.ts:33` — remove `.andWhere('user.role = :role', { role: ROLES.ORG_USER })`
- Modify: `controllers/user/listUser.ts:~108` — change `canDelete` from role-based to permission-based
- Modify: `controllers/user/addUser.ts:36` — accept `role` from request body instead of hardcoding
- Modify: `controllers/user/getUser.ts` — change `canDelete` to always true (user already passed permission check)

- [ ] **Step 1: listUser.ts — remove role filter, fix canDelete**

Remove line: `.andWhere('user.role = :role', { role: ROLES.ORG_USER })`

Change canDelete to `true` (if you reached this endpoint, you have permission):

```typescript
const usersWithMeta = users.map((user: any) => ({
  ...user,
  canDelete: user.isDefault !== 1,
  isLocked: !!user.accountLockedAt,
  roleName: user.roleId ? roleMap[user.roleId] || null : null,
}));
```

- [ ] **Step 2: addUser.ts — accept `role` field from request body**

```typescript
const {
  email,
  username,
  firstName,
  lastName,
  organisation,
  roleId,
  role: systemRole,
} = req.body;
// ...
user.role = systemRole || ROLES.ORG_USER; // Default to ORG_USER if not specified
```

- [ ] **Step 3: getUser.ts — change canDelete**

```typescript
canDelete: loggedInRole === ROLES.SYSTEM_ADMIN || orgUser.isDefault !== 1,
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit`

### Task 4: Update user validation middleware to handle ALL org users

**Files:**

- Modify: `middleware/user/getUser.validation.ts:36` — remove `role: ROLES.ORG_USER` from findOne where
- Modify: `middleware/user/deleteUser.validation.ts:37` — remove `role: ROLES.ORG_USER` from findOne where
- Modify: `middleware/user/updateUser.validation.ts:47` — remove `role: ROLES.ORG_USER` from findOne where
- Modify: `middleware/user/updatePassword.validation.ts:45` — remove `role: ROLES.ORG_USER` from findOne where
- Modify: `middleware/user/addUser.validation.ts` — add `role` (system role) to Joi schema

- [ ] **Step 1: Remove `role: ROLES.ORG_USER` from all user existence queries**

In each file, change:

```typescript
where: { id, role: ROLES.ORG_USER, organisationId: orgData.id }
```

to:

```typescript
where: { id, organisationId: orgData.id }
```

- [ ] **Step 2: Add `role` field to addUser.validation.ts schema**

```typescript
const schema = Joi.object({
  email: fields.email.required(),
  username: fields.username.required(),
  firstName: fields.firstName.required(),
  lastName: fields.lastName.required(),
  organisation: fields.organisation.required(),
  roleId: fields.id.required(),
  role: Joi.string()
    .valid('ORG-ADMIN', 'ORG-USER')
    .optional()
    .default('ORG-USER'),
});
```

- [ ] **Step 3: deleteUser.validation.ts — add self-delete and default-admin protection**

Port the protections from `deleteAdmin.validation.ts`:

```typescript
if (loggedInId === id) {
  return sendResponse(
    res,
    false,
    CODE.BAD_REQUEST,
    'You cannot delete yourself',
  );
}

const orgUser = await master_db_connection.getRepository(User).findOne({
  where: { id, organisationId: orgData.id },
});

if (!orgUser) {
  return sendResponse(res, false, CODE.NOT_FOUND, USER_MSG.NOT_FOUND);
}

if (loggedInRole !== ROLES.SYSTEM_ADMIN && orgUser.isDefault === 1) {
  return sendResponse(
    res,
    false,
    CODE.BAD_REQUEST,
    'Cannot delete default admin',
  );
}

res.locals.orgUser = orgUser;
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit`

### Task 5: Delete org-admin backend module

**Files to delete:**

- Delete: `controllers/admin/` (entire directory — 8 files)
- Delete: `middleware/orgAdmin/` (entire directory — 6 files)
- Delete: `routes/admin.routes.ts`

**Files to modify:**

- Modify: `server.ts` — remove `import adminRoutes` and `app.use('/api/v1/org-admin', adminRoutes)`

- [ ] **Step 1: Remove admin routes from server.ts**

Remove line: `import adminRoutes from './routes/admin.routes';`
Remove line: `this.app.use('/api/v1/org-admin', adminRoutes);`

- [ ] **Step 2: Delete the 3 directories/files**

```bash
rm -rf src/controllers/admin/
rm -rf src/middleware/orgAdmin/
rm -f src/routes/admin.routes.ts
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit`

---

## Phase 3: Merge Org-Admin into Users (Frontend)

### Task 6: Update FE user service and constants

**Files:**

- Modify: `UltraSignal-UI/src/app/constants/api.ts` — remove `ORG_ADMIN` object
- Modify: `UltraSignal-UI/src/app/constants/routes.ts` — remove `ORGANISATION_ADMIN` object
- Modify: `UltraSignal-UI/src/app/modules/users/services/user.service.ts` — add `role` to addUser payload

- [ ] **Step 1: Remove ORG_ADMIN from api.ts and ORGANISATION_ADMIN from routes.ts**

- [ ] **Step 2: Update user.service.ts addUser to include `role`**

```typescript
addUser(userForm: FormGroup) {
  return this.http
    .post(USER.ADD, {
      email: userForm.value.email,
      username: userForm.value.username,
      firstName: userForm.value.firstName,
      lastName: userForm.value.lastName,
      organisation: userForm.value.organisation,
      roleId: userForm.value.roleId,
      role: userForm.value.role,
    })
    ...
}
```

### Task 7: Update FE add-users to include system role selector

**Files:**

- Modify: `UltraSignal-UI/src/app/modules/users/components/add-users/add-users.component.ts`
- Modify: `UltraSignal-UI/src/app/modules/users/components/add-users/add-users.component.html`

- [ ] **Step 1: Add `role` form control and `systemRoles` options**

```typescript
systemRoles = [
  { label: 'Admin', value: 'ORG-ADMIN' },
  { label: 'User', value: 'ORG-USER' },
];

// In initForm():
role: ['ORG-USER', Validators.required],
```

- [ ] **Step 2: Add system role dropdown to HTML** (before the role dropdown)

```html
<app-custom-dropdown
  formControlName="role"
  label="System Role"
  placeholder="Select System Role"
  [options]="systemRoles"
  optionLabel="label"
  optionValue="value"
  [required]="true"
>
</app-custom-dropdown>
```

### Task 8: Update FE edit-users and view-users

**Files:**

- Modify: `edit-users.component.ts` — add `role` field, `systemRoles`, patch on load
- Modify: `edit-users.component.html` — add system role dropdown
- Modify: `view-users.component.ts` — fix delete navigation to `USER.LIST`, add `systemRole` display
- Modify: `view-users.component.html` — add system role display, change page title to "User Details"

- [ ] **Step 1: view-users.component.ts** — change `ORGANISATION_ADMIN` import to `USER`, fix `proceedDelete` navigation
- [ ] **Step 2: view-users.component.html** — add "System Role" detail item showing `userData?.role`
- [ ] **Step 3: edit-users.component.ts** — add `role` form control, `systemRoles` array, patch `role` on load
- [ ] **Step 4: edit-users.component.html** — add system role dropdown
- [ ] **Step 5: user.service.ts** — add `role` to updateUser payload

### Task 9: Update FE routing, sidebar, and home

**Files:**

- Modify: `app-routing.module.ts` — remove org-admin route, update users route to allow both roles
- Modify: `sidebar.constant.ts` — update `HOME_ROUTES.ORG_ADMIN` → use same as ORG_USER
- Modify: `home-routing.module.ts` — merge org-admin route into a unified org route
- Modify: `empty-root.component.ts` — ORG_ADMIN navigates to same home as ORG_USER
- Modify: `header.component.ts` — remove `isOrgAdmin` field (keep announcement logic using role directly)
- Modify: `auth.guard.ts` — update `getDefaultRouteByRole` for ORG_ADMIN

- [ ] **Step 1: app-routing.module.ts** — remove org-admin lazy route, change users route roles to `['ORG-ADMIN', 'ORG-USER']`

```typescript
// Remove:
{
  path: 'org-admin',
  loadChildren: () => import('./modules/organisation-admin/organisation-admin.module')...
}

// Change users:
{
  path: 'users',
  ...,
  data: { roles: ['SUPER-ADMIN', 'ORG-ADMIN', 'ORG-USER'], permission: PERMISSIONS.USER_MANAGEMENT, title: 'Users' },
},
```

- [ ] **Step 2: sidebar.constant.ts** — change `HOME_ROUTES.ORG_ADMIN` to same path as ORG_USER

```typescript
export const HOME_ROUTES = {
  SYSTEM_ADMIN: '/app/home/super-admin',
  ORG_ADMIN: '/app/home/org',
  ORG_USER: '/app/home/org',
};
```

- [ ] **Step 3: home-routing.module.ts** — replace `org-admin` and `org-user` routes with single `org`

```typescript
{
  path: 'org',
  component: OrgHomeComponent,
  canActivate: [RoleGuard],
  data: { roles: ['ORG-ADMIN', 'ORG-USER'] },
},
```

- [ ] **Step 4: empty-root.component.ts** — both ORG_ADMIN and ORG_USER navigate to `/app/home/org`
- [ ] **Step 5: auth.guard.ts** — update `getDefaultRouteByRole` to use `HOME_ROUTES.ORG_ADMIN` (which now points to `/app/home/org`)

### Task 10: Delete FE org-admin module and clean up references

**Files to delete:**

- Delete: `UltraSignal-UI/src/app/modules/organisation-admin/` (entire directory)

**Files to modify:**

- Modify: `list-audit-logs.component.ts` — change `{ label: 'Org Admin', value: 'org-admin' }` to `{ label: 'User', value: 'user' }` (since all user operations now audit as 'user' module)

- [ ] **Step 1: Delete the org-admin FE module directory**
- [ ] **Step 2: Update audit logs module filter**
- [ ] **Step 3: Verify FE builds** — `ng build`

---

## Phase 4: Role Module UI Modernization

### Task 11: Modernize list-role component (TS)

**Files:**

- Modify: `UltraSignal-UI/src/app/modules/role/components/list-role/list-role.component.ts`

Rewrite to match the Users module pattern:

- Add `@ViewChild('dt') dt!: Table`
- Add `Subject` + `debounceTime` for filtering
- Add `filterValues` object with per-column fields (name, description, status, createdDateRange)
- Add `lastTableLazyLoadEvent` for lazy loading
- Add `isFilterActive` getter
- Add `onLazyLoad()`, `onFilterChange()`, `clearFilters()` methods
- Replace manual pagination with PrimeNG table's built-in lazy pagination
- Implement `OnDestroy` for subscription cleanup

The BE `listRole` API currently returns all roles at once (no pagination). The FE can still use p-table with client-side lazy loading, or we can keep the current BE behavior and paginate client-side. Since roles are typically < 50 per org, client-side is fine.

- [ ] **Step 1: Rewrite list-role.component.ts**
- [ ] **Step 2: Verify imports are correct**

### Task 12: Modernize list-role template (HTML)

**Files:**

- Modify: `UltraSignal-UI/src/app/modules/role/components/list-role/list-role.component.html`

Rewrite to match Users module pattern:

- Page header with subtitle
- Card wrapper with toolbar (org dropdown left, clear filters + add button right)
- PrimeNG `p-table` with:
  - Header row with column names
  - Filter row with per-column inputs
  - Body template with data rows
  - Empty message template
- Modern confirmation popup (matching users delete popup)

- [ ] **Step 1: Rewrite list-role.component.html**

### Task 13: Modernize list-role styles (SCSS)

**Files:**

- Modify: `UltraSignal-UI/src/app/modules/role/components/list-role/list-role.component.scss`

Replace 899-line custom SCSS with the standardized Users module SCSS pattern (card layout, toolbar, p-table overrides, confirmation popup).

- [ ] **Step 1: Rewrite list-role.component.scss** (copy from list-users.component.scss and adjust)

---

## Phase 5: Verification

### Task 14: Full verification

- [ ] **Step 1: BE type check** — `cd UltraSignal-API && npx tsc --noEmit`
- [ ] **Step 2: FE build** — `cd UltraSignal-UI && ng build`
- [ ] **Step 3: Manual smoke test** — Start both servers, verify:
  - Login as ORG_ADMIN → lands on `/app/home/org`
  - Sidebar shows Users, Roles, etc. based on permissions
  - Users list shows BOTH ORG-ADMIN and ORG-USER users
  - Can add a new user with system role "Admin" or "User"
  - Can edit/delete users regardless of their system role
  - Roles list uses modern PrimeNG table with filters
  - List permissions API works without 400 error
  - `/api/v1/org-admin/*` returns 404 (removed)
