# UltraSignal-API — Backend Reference

## Project Overview

Express + TypeScript backend for UltraSignal — a pharmacovigilance signal-detection platform with multi-tenant client isolation. Uses TypeORM with PostgreSQL, JWT authentication, and per-client crypto isolation.

## Quick Start

```bash
npm run dev      # Development (nodemon + ts-node)
npm run build    # Compile TypeScript → dist/
npm start        # Production (node dist/src/app.js)
npx tsc --noEmit # Type-check without emitting
```

## Architecture

### Multi-Tenancy Model

- **Master DB**: Stores super admins, organisations, org configs, databases, master audit logs
- **Shared DB (per org)**: Each organisation gets its own PostgreSQL database with users, groups, datasets, screens, queries, etc.
- Master entity = `src/db/master_entity/` | Shared entity = `src/db/shared_entity/`

### Request Flow

```
Route → AuthMiddleware → VerifyResourceMiddleware → VerifyDatabaseMiddleware → ValidationMiddleware → Controller
```

### Directory Structure

Domain-first layout. Each feature owns its controllers, validation, and
routes; cross-cutting code lives under `shared/`.

```
src/
├── app.ts / server.ts          # Bootstrap & Express setup
├── modules/
│   ├── <domain>/               # plural kebab-case: users, orgs, audit-logs, ...
│   │   ├── controllers/        # One file per action (addUser.ts, getUser.ts, ...)
│   │   ├── middleware/         # Joi validation per endpoint
│   │   └── <domain>.routes.ts  # Express Router (mounted by server.ts)
│   ...
└── shared/
    ├── db/
    │   ├── index.ts            # Master DB connection + auto-onboard
    │   ├── master/             # Master-DB entities (User, Organisation, ...)
    │   └── shared/             # Per-org-DB entities (User, Dataset, ...)
    ├── middleware/             # auth, trimBody, verifyDatabase, verifyResource, locale
    ├── services/               # auditLogger, filterEngine, connectionPool, crypto, sqlBuilder
    ├── helpers/                # dataset, datasource, organisation, system, visualisations
    ├── utility/                # jwt, encrypt/decrypt, response, validate, mail/, logger/
    ├── constants/              # response.messages, audit.constants, permissions/
    └── locales/                # 10-language i18n JSONs
```

Domain folder names are plural kebab-case — matching the URL convention
(`/api/v1/users`, `/api/v1/audit-logs`). Auth middleware lives under
`modules/auth/middleware/` because it's logically part of the auth domain;
generic per-request middleware (trim body, verify org, verify resource,
locale) lives under `shared/middleware/`.

## Key Patterns

### Response — Always use `sendResponse()`

```typescript
import sendResponse from '../../../shared/utility/response';
// sendResponse(res, status: boolean, code: number, message: string, data?: any)
sendResponse(res, true, CODE.SUCCESS, USER_MSG.CREATED, user);
sendResponse(res, false, CODE.BAD_REQUEST, error);
```

Response shape: `{ status, code, message, data }`

### Validation — Joi schemas + `validateSchema()`

```typescript
import { fields } from '../../utility/joi.schemas';
import { validateSchema } from '../../utility/validate.middleware';

const schema = Joi.object({
  email: fields.email.required(),
  username: fields.username.required(),
  firstName: fields.firstName.required(),
});

// In middleware:
const { error, value } = validateSchema(schema, req.body);
if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);
req.body = value; // Sanitized + trimmed
```

Options: `abortEarly: true`, `stripUnknown: true`

### Controller — One function per file

```typescript
const addUser = async (req: Request, res: Response) => {
  Logger.info(`Add Org User request`);
  const { email, username } = req.body;
  const { loggedInId, orgData, master_db_connection } = res.locals;

  try {
    const user = new User();
    // ... set fields ...
    await master_db_connection.getRepository(User).save(user);

    // Audit log (awaited before closing connection)
    await auditLogger.logAuditToOrg({ connection, req, res, module, action, ... });

    // Email notification (fire-and-forget)
    welcomeEmailToUser(email, fullName, username, ...);

    await master_db_connection.close();
    sendResponse(res, true, CODE.SUCCESS, MSG.CREATED, user);
  } catch (error) {
    Logger.error(`Error: ${error.message}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};
export default addUser;
```

### Audit Logging

```typescript
import { auditLogger } from '../../services/auditLogger.service';
import { snapshotEntity, AUDIT_FIELDS } from '../../utility/auditMetadata';
import { AUDIT_MODULES, AUDIT_ACTIONS } from '../../constants/audit.constants';

// Master DB (fire-and-forget)
auditLogger.logAudit({ req, res, module: AUDIT_MODULES.USER, action: AUDIT_ACTIONS.CREATE, ... });

// Org DB (awaitable — call before closing connection)
await auditLogger.logAuditToOrg({ connection, req, res, module, action, entityName, entityId, metadata: { entity: snapshotEntity(user, AUDIT_FIELDS.USER) } });
```

### Route Registration

```typescript
router.post(
  '/add',
  AuthMiddleware,
  VerifyResourceMiddleware,
  VerifyDatabaseMiddleware,
  AddUserValidation,
  controller.add,
);
router.get(
  '/list',
  AuthMiddleware,
  VerifyResourceMiddleware,
  VerifyDatabaseMiddleware,
  ListValidation,
  controller.list,
);
```

Super admin routes skip VerifyDatabase/VerifyResource (use AuthMiddleware + validation only).

### User Onboarding (Setup Token Flow)

```typescript
import { generateSetupToken } from '../../utility/generateSetupToken';
import welcomeEmailToUser from '../../utility/mail/welcomeEmailToUser';

const setupToken = generateSetupToken(); // 32-byte random hex
user.setupToken = setupToken; // Master entity: plain | Shared entity: encrypted with org pepper
user.setupTokenExpiresAt = new Date(
  Date.now() + SETUP_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
);
await user.save();

welcomeEmailToUser(
  email,
  fullName,
  username,
  orgName,
  role,
  userId,
  orgId,
  setupToken,
);
```

- User/Admin/SuperAdmin all use this flow (no inline password)
- User clicks email link → `/set-password?token=...&id=...&orgId=...`
- Backend: `verifySetupToken` → `setPassword` → `resendSetupLink` (all in `controllers/auth/`)

## Roles & Auth

```
ROLES.SYSTEM_ADMIN = 'SYSTEM-ADMIN'  // Master DB user, platform operator
ROLES.ORG_ADMIN   = 'ORG-ADMIN'    // Org-scoped admin
ROLES.ORG_USER    = 'ORG-USER'     // Org-scoped end user
```

- JWT token in header: `x-auth-token`
- Token payload: `{ id, role, organisationId, permissions, username, name }`
- `res.locals` carries: `loggedInId`, `loggedInRole`, `orgData`, `master_db_connection`

### Authorisation model

Permissions are DB-backed, not hardcoded by role string. Each user's role row
(master DB `Role` for the platform System Admin; per-org `Role` for
`Administrator` / `Member` inside an organisation) carries a JSON permission
tree. Login resolves the permissions from that row and stamps them into the
JWT.

Routes gate access with `VerifyPermissionMiddleware('<permissionValue>')` —
the middleware walks the JWT's permission tree (top-level + nested
`subPermissions`) and 401s if the value is missing. There is no role-name
bypass. System admins are denied per-organisation routes because their
master-DB Role row does not list `userManagement`, `datasetManager`,
`dashboard`, etc.

The platform-level System Admin permission set lives in
`src/shared/constants/permissions/systemAdminV2.ts` and covers only:

- `home`
- `systemManagement` → `systemAdmin`, `orgManagement`
- `auditActivity` → `auditLogs`, `loginActivity`
- `appSettings` → `announcementManagement`

That set is seeded into the master-DB `Role` table on first boot
(`src/shared/helpers/system/seedSystemAdminRole.ts`); the seeded super admin's
`user.roleId` foreign-keys into it. Inside an organisation the bootstrap admin
is granted the per-org `Administrator` role (created during org onboarding by
`src/modules/orgs/controllers/addOrg.ts`), which carries the full
`organisationAdmin` permission set. Subsequent users created inside the org
are assigned roles by the org admin and inherit whatever permissions that
role exposes — no cross-org access, no hardcoded permission bundles.

Module migration to `VerifyPermissionMiddleware`: **done across every
module** (`orgs`, `system-admins`, `announcements`, `audit-logs`, `users`,
`groups`, `roles`, `access`, `rls-rules`, `datasets`, `analyses`,
`analysis-filters`, `dashboards`, `datasources`, `connections`,
`query-builders`, `tabs`, `sections`, `prompts`, `visuals`, `queries`).
The platform System Admin only carries `home`, `systemAdmin`,
`orgManagement`, `auditLogs`, `loginActivity`, `announcementManagement`,
and `appSettings`; any per-org route the System Admin tries to hit
returns 401 at the permission layer. Org admins / org users only carry
permissions for their own org's resources.

`VerifyResourceMiddleware` is the second line of defence: it rejects any
`x-organization-id` header that doesn't match the JWT's `organisationId`,
with no role-name bypass. The `orgs` and `system-admins` routers don't
go through this middleware (they operate on the master DB directly), so
the System Admin's cross-org operations on those routes still work.

Audit-log controllers (`listAuditLog`, `listLoginActivity`,
`exportAuditLogs`, `exportLoginActivity`) used to honour a
`parsedFilter.organisationId` override when the caller was SYSTEM-ADMIN;
that branch is gone — `targetOrgId` is always the caller's own org id.

**JWT is the single source of org id.** Every layer that previously
let the FE name an org — request headers, URL path params, body
fields — is gone:

- `AuthMiddleware` decodes the JWT and sets `res.locals.organisationId`.
- `VerifyResourceMiddleware` reads ONLY `res.locals.organisationId`;
  no `x-organization-id` header check, no `req.params.orgId` lookup.
- `VerifyMasterDatabaseMiddleware` reads ONLY `res.locals.organisationId`
  (its old 7-way fallback cascade is gone).
- `SanitizeOrgInputMiddleware` (`src/shared/middleware/sanitizeOrgInput.middleware.ts`)
  runs globally on every protected route. It deletes
  `organisation` / `organisationId` / `orgId` from `req.body`,
  `req.params`, and `req.query` before any downstream code can see
  them. Auth routes (login, refresh-token, generateOTP, etc.) are
  mounted BEFORE the sanitizer in `server.ts` so their legitimate
  pre-JWT `organisation` body field is preserved.
- All 18 per-org route files lost `:orgId` from their URL patterns
  (187 occurrences). Routes are now `/<resource>/:id` and
  `/<resource>/bulk-delete`, never `/<resource>/:orgId/:id`.
- 32 Joi validation files (28 in the original sweep + 4 in
  analysis-filters / rls-rules) lost their `organisation:` body
  schema entries. Every validation sources org id from
  `res.locals.organisationId`.
- The 3 controllers that read `req.body.organisation` (addRole,
  globalSearch, publishDashboard + listRole's query param) all
  switched to `res.locals.orgData.id`.

**Cross-org isolation invariant** — every controller's resource
lookup follows the pattern:

```typescript
const { orgData, master_db_connection } = res.locals;
const row = await master_db_connection.getRepository(X).findOne({
  where: { id, organisationId: orgData.id },
});
if (!row) return sendResponse(res, false, CODE.NOT_FOUND, X_MSG.NOT_FOUND);
```

A caller from org A requesting a resource that belongs to org B
gets a 404 — the query simply doesn't return the row. There's no
explicit "is this your org?" check because the filter is implicit.
The sanitizer middleware ensures `req.body.organisationId` /
`req.params.orgId` / `req.query.orgId` can never override
`orgData.id` even if a future controller mistakenly reads them.

On the FE:

- The HTTP interceptor no longer sends `x-organization-id`.
- All 17 per-org services dropped `orgId` from method signatures and
  `${orgId}/` from URL templates. `bulkDelete(ids, justification?, orgId)`
  → `bulkDelete(ids, justification?)`. `loadOne(orgId, id)` → `loadOne(id)`.
- 68 component files cleaned: `showOrganisationDropdown` (and aliases),
  `loadOrgsPage`, `loadOrganisations`, `preloadedOrgs`, `OrganisationService`
  imports, `organisation: [...]` form-control entries, and `if (flag)`
  branches all gone. Read-only "Organisation: <name>" displays on
  `view-*` and `edit-*` screens kept as informational badges.
- `OrganisationService` is still imported in `add-datasource` and
  `edit-datasource` for `validateDatasource()` connection-test calls,
  and in the system-admin screens that intentionally browse other
  orgs (`view-organisation`, `list-organisation`, `view-system-admin`).

After this work, an attacker cannot switch tenants by manipulating
any client-controlled input. The JWT is signed and the only thing the
BE trusts for org identity.

Remaining deferred follow-up:

- Drop the legacy `permissions` column on master-DB `User` once every
  consumer reads from the `Role` table.

## Status Codes (from config)

```
CODE.SUCCESS = 200 | CODE.BAD_REQUEST = 400 | CODE.UNAUTHORIZED = 401
CODE.NOT_FOUND = 404 | CODE.ALREADY_EXISTS = 405 | CODE.SESSION_EXPIRED = 440
CODE.SERVER_ERROR = 500
```

## Response Messages

All in `src/constants/response.messages.ts`. Grouped by domain:
`GENERIC`, `AUTH`, `ORGANISATION`, `USER`, `SYSTEM_ADMIN`, `ORG_ADMIN`, `DATABASE`, `DATASET`, `TAB`, `SECTION`, `PROMPT`, `SCREEN`, `GROUP`, `CONNECTION`, `ACCESS`, `ANALYSES`, `VISUAL`, `ANNOUNCEMENT`, `AUDIT_LOG`

## Permissions

Defined in `src/shared/constants/permissions/`:

- `systemAdminV2.ts` — Home, System Mgmt (System Admin + Org Mgmt), Audit
  & Activity, App Settings (Announcement Mgmt). **Active** — seeded into
  the master-DB `Role` table on first boot.
- `systemAdmin.ts` — full legacy System Admin permission tree.
  **Reference / rollback only**. Not active at runtime.
- `organisationAdmin.ts` — Dashboard, User Mgmt, Data Mgmt, UltraSignal Studio,
  Visualizations. Seeded into the per-org `Role` table as `Administrator`
  during org onboarding.
- `user.ts` — Dashboard, Query Executor. Seeded into the per-org `Role`
  table as `Member` during org onboarding.

Permission shape: `{ id, parentId, label, value, status, icon, subPermissions? }`

Permissions are now sourced from the DB at login (`Role.permissions` is a
JSON string) and stamped into the JWT. The constants files act as one-time
seed sources; once the seed runs, the DB rows are the source of truth and
editing the constants does not retroactively change live roles.

## Key Dependencies

TypeORM 0.2 (decorator-based entities), Joi 17 (validation), jsonwebtoken (JWT), CryptoJS (encryption), nodemailer + handlebars (emails), Winston (logging), ExcelJS/jsPDF (exports)

## Conventions

- **Error handling**: Always try-catch in controllers, log with `Logger.error()`, respond with `sendResponse()`
- **Validation**: In middleware, not controllers. Use `fields.*` from `joi.schemas.ts`
- **DB connections**: Stored in `res.locals.master_db_connection`. Always close after use
- **Audit**: Log all CUD operations with `snapshotEntity()` + `AUDIT_FIELDS` allowlists
- **Naming**: Controller files = `addUser.ts`, `getUser.ts`, `listUser.ts`, `deleteUser.ts`, `updateUser.ts`
- **Exports**: Each controller file exports a single default async function
- **No raw responses**: Never `res.send()` or `res.json()` directly — always `sendResponse()`
