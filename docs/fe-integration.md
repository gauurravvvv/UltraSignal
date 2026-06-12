# FE Integration — Request Payloads

Quick reference for every endpoint the FE needs to hit and what payload
the BE expects. Grouped by feature/screen. Auth + permission columns
tell you what headers and JWT permission levels each route needs.

For per-endpoint deep docs (errors, response shapes, edge cases) see:
- `docs/add-role-api.md` — role create flow
- `docs/data-source-api.md` — data source CRUD + test connection

---

## Common envelope

**Every request needs:**

| Header | Value |
|---|---|
| `x-auth-token` | JWT from `/api/v1/auth/login` |
| `Content-Type` | `application/json` (on POST / PUT) |

**Every response comes back as:**

```jsonc
{
  "status": true | false,
  "code": <http-code>,
  "message": "<i18n key or string>",
  "data": <payload | undefined>,
  "meta": { "requestId": "...", "durationMs": 12 }
}
```

---

## 1. Authentication

### Login

```
POST /api/v1/auth/login
```

Body:
```json
{
  "username": "...",
  "password": "...",
  "client": "<client name>"
}
```

Returns `accessToken`, `refreshToken`, basic user info.

### Refresh token

```
POST /api/v1/auth/refresh
```

Body:
```json
{ "refreshToken": "<opaque-token>" }
```

**No `client` field.** The refresh token alone identifies the user.

### Session bootstrap

```
GET /api/v1/auth/session
```

No body. Returns user + permissions tree + role + `sessionInactivityTimeout`.

---

## 2. Detection Profiles (Threshold Profiles)

Module path on FE: `detection-profiles`. Permission: `detectionProfile`.

### List (with pagination, filter, sort)

```
GET /api/v1/threshold-profiles
  ?page=1
  &limit=20
  &filter=<URL-encoded JSON>
  &sort=createdOn:desc
```

`filter` JSON (all keys optional, send only what's filled in):
```jsonc
{
  "name":            "standard",      // ILIKE on display_name
  "code":            "STANDARD",      // ILIKE on code
  "description":     "primary",       // ILIKE
  "scopeId":         2,               // exact (use scopeId from /scopes)
  "status":          1,               // 0 = disabled, 1 = enabled
  "createdDateFrom": "2026-01-01",
  "createdDateTo":   "2026-12-31"
}
```

Sort field whitelist: `displayName`, `code`, `isEnabled`, `createdOn`.

Permission: `detectionProfile` READ.

### Get one

```
GET /api/v1/threshold-profiles/:id
```

No body. Returns profile + scope + conditions + `canEdit`/`canDelete` flags.

Permission: `detectionProfile` READ.

### Copy / Save (creates new editable copy)

```
POST /api/v1/threshold-profiles/:id/copy
```

Body:
```json
{
  "code": "STANDARD_COPY",
  "displayName": "Standard SDR (EMA/FDA) (Copy)",
  "description": "",
  "category": "System",
  "methods": [
    { "id": 36, "metric": "a",      "operator": ">=", "value": 3, "isEnabled": false },
    { "id": 37, "metric": "prr",    "operator": ">=", "value": 2, "isEnabled": true  },
    { "id": 38, "metric": "prr025", "operator": ">=", "value": 1, "isEnabled": true  }
  ]
}
```

| Field | Required | Notes |
|---|:---:|---|
| `code` | ✅ | Auto-uppercased. 2–64 chars, `[A-Z0-9_-]`. Globally unique. |
| `displayName` | ✅ | 2–128 chars. |
| `description` | optional | Leave `""` or `null` for blank; **does NOT inherit from source**. |
| `category` | optional | Informational (source's scope label). Dropped on BE — for FE display only. |
| `methods` | optional | If sent: each `{ metric, operator (>=, <=, >, <, =, !=), value, isEnabled }`. `id` accepted but ignored (new rows get fresh ids). If omitted: clones the source's conditions verbatim. |

Permission: `detectionProfile` WRITE. The copy auto-becomes `scope=org`, `clientId=<your tenant's clientCode>`, so it'll be editable.

### Update / Edit

```
PUT /api/v1/threshold-profiles/:id
```

Body (all fields optional except `id`):
```json
{
  "id": 2,
  "displayName": "...",
  "code": "...",
  "description": "...",
  "status": 1,
  "methods": [
    { "metric": "a", "operator": ">=", "value": 3, "isEnabled": true }
  ]
}
```

| Field | Behavior |
|---|---|
| `id` | Required. Path param echoed in body. |
| `displayName`, `code`, `description`, `status` (0/1) | All optional. Send only changed. |
| `methods` | Omit = conditions untouched. `[]` = wipe all. Array = full replace. |
| `scopeId`, `isDefault`, `clientId` | **Forbidden** — 400 if present. |

Permission: `detectionProfile` WRITE. System-scope profiles → 403.

### Delete

```
DELETE /api/v1/threshold-profiles/:id
```

No body. Permission: `detectionProfile` FULL. System-scope profiles → 403.

---

## 3. Product Browser

Module path on FE: `product-browser`. Permission: `productGroup` READ.

### Search (type=0) + Hierarchy walk (type=1) — same endpoint

```
POST /api/v1/product-browser/search
```

Body:
```json
{
  "type": 0,
  "searchedValue": "paracetamol",
  "level": "INGREDIENT",
  "sourceSystem": "UAN"
}
```

| Field | Required | Notes |
|---|:---:|---|
| `type` | optional, default `0` | `0` = ILIKE search, `1` = exact-match hierarchy walk. |
| `searchedValue` | ✅ | 1–255 chars. The term to match. |
| `level` | ✅ | `INGREDIENT`, `PRODUCT_FAMILY`, `PRODUCT_NAME`, `TRADE_NAME`, or `ALL` (`ALL` only valid for `type=0`). |
| `sourceSystem` | ✅ | E.g. `UAN`, `AEMS`. Exact match. |

**Response is the same shape for both types:**

```json
{
  "ingredients": [{ "name": "...", "code": "...", "original_name": "..." }],
  "pFamily":     [...],
  "pName":       [...],
  "tradeName":   [...]
}
```

**Which arrays get populated:**

| `type` | `level` | Populated arrays |
|---|---|---|
| 0 | INGREDIENT | ingredients |
| 0 | PRODUCT_FAMILY | pFamily |
| 0 | PRODUCT_NAME | pName |
| 0 | TRADE_NAME | tradeName |
| 0 | ALL | all four |
| 1 | INGREDIENT | pFamily |
| 1 | PRODUCT_FAMILY | ingredients + pName |
| 1 | PRODUCT_NAME | ingredients + pFamily + tradeName |
| 1 | TRADE_NAME | ingredients + pFamily + pName |

---

## 4. Data Sources (per-client config)

Module path on FE: `data-sources`. Permission: `dataSource`.

### Create

```
POST /api/v1/data-sources
```

Body:
```json
{
  "name": "Production AEMS Feed",
  "description": "...",
  "typeId": "<uuid-from-/data-source-types>",
  "host": "db.example.com",
  "port": 5432,
  "dbname": "prod",
  "username": "ingest",
  "password": "<plaintext>",
  "schema": "public"
}
```

| Field | Required | Notes |
|---|:---:|---|
| `name` | ✅ | 2–64 chars. Unique per client. |
| `description` | optional | ≤ 500 chars. |
| `typeId` | ✅ | UUID from `GET /data-source-types`. |
| `host` | ✅ | 1–255 chars. |
| `port` | ✅ | 1–65535. |
| `dbname` | ✅ | 1–128 chars. |
| `username` | ✅ | 1–128 chars. |
| `password` | ✅ | Plaintext; encrypted on save. |
| `schema` | ✅ | Postgres schema name. Pattern `[A-Za-z_][A-Za-z0-9_]*`. |

Permission: `dataSource` WRITE.

### Test connection (no persistence)

```
POST /api/v1/data-sources/test-connection
```

Same `{ host, port, dbname, username, password, schema }` body as Create.
Returns `{ ok: true }` or 400 with the Postgres error message.

Permission: `dataSource` WRITE.

### List

```
GET /api/v1/data-sources?page=1&limit=20&filter=<json>&sort=name:asc
```

Filter keys: `name`, `description`, `typeId`, `status`, `createdDateFrom`, `createdDateTo`.

Permission: `dataSource` READ.

### Get one

```
GET /api/v1/data-sources/:id
```

Returns the data source with `type` joined. **`password` is never returned** — the column is `select: false`. Leave the password input blank on edit; only send a new value to change it.

### Update / Edit

```
PUT /api/v1/data-sources/:id
```

Body — all fields optional except `id`. **Send `password` only if the user typed a new one** (empty/null = keep stored).

```json
{
  "id": "<uuid>",
  "name": "...",
  "description": "...",
  "host": "...",
  "port": 5432,
  "dbname": "...",
  "username": "...",
  "password": "",
  "schema": "...",
  "status": 1
}
```

`typeId` is **forbidden** — type can't change after creation.

### Delete

```
DELETE /api/v1/data-sources/:id
```

Permission: `dataSource` FULL. Soft delete.

---

## 5. Catalogs (reference data for dropdowns)

All catalog endpoints return read-only system data. Cache them client-side
where possible.

### Scopes

```
GET /api/v1/scopes
```

For the scope dropdown on threshold-profile / stats-constants filters.
Returns 4 rows: System, Organization, User, Ad-hoc.

Permission: AuthMiddleware only.

### Access levels

```
GET /api/v1/access-levels
```

For the role editor's None/Read/Write/Full column headers.

Permission: AuthMiddleware only.

### Permission catalog

```
GET /api/v1/permissions?scope=ORG[&roleId=<uuid>][&includeInactive=false]
```

For the role editor's permission rows. If `roleId` is sent, each row
carries the role's current `level` (0-3) for prefill.

Permission: AuthMiddleware only.

### Data source types

```
GET /api/v1/data-source-types
```

Returns AEMS, UAN (with `id` UUID + `sourceId` integer). Use the `id`
when creating a Data Source.

Permission: `dataSource` READ.

---

## 6. Roles

Permission: `roles`.

| Method | URL | Permission | Notes |
|---|---|---|---|
| POST | `/api/v1/roles` | WRITE | Body: `{ name, description?, selectedPermissions: [{ permissionId, level }] }`. See `docs/add-role-api.md`. |
| GET | `/api/v1/roles` | READ | `?page&limit&filter&sort` |
| GET | `/api/v1/roles/:id` | READ | Returns role + granted permissions with parent chain. |
| PUT | `/api/v1/roles/:id` | WRITE | Same body as create (selectedPermissions optional — if sent, wholesale replaces). |
| DELETE | `/api/v1/roles/:id` | FULL | Default roles → 403. |
| POST | `/api/v1/roles/bulk-delete` | FULL | Body: `{ ids: [...] }` |

---

## 7. Users

Permission: `users`.

### Create

```
POST /api/v1/users
```

Body:
```json
{
  "email": "...",
  "username": "...",
  "firstName": "...",
  "lastName": "...",
  "groupIds": ["<uuid>", "<uuid>"],
  "locale": "en"
}
```

User receives an email with a setup token to set their own password.

### Update

```
PUT /api/v1/users/:id
```

Body:
```json
{
  "id": "<uuid>",
  "email": "...",
  "username": "...",
  "firstName": "...",
  "lastName": "...",
  "status": 1,
  "groupIds": ["<uuid>"]
}
```

Default user (`isDefault: 1`) → 401, no field can be modified.

### Delete / Bulk delete

```
DELETE /api/v1/users/:id
POST   /api/v1/users/bulk-delete   body: { ids: [...] }
```

Default user → 401.

---

## 8. Groups

Permission: `groups`.

| Method | URL | Body |
|---|---|---|
| POST | `/api/v1/groups` | `{ name, description?, roleId }` |
| PUT | `/api/v1/groups/:id` | `{ id, name?, description?, roleId?, status? }` |
| GET | `/api/v1/groups` | `?page&limit&filter&sort&roleId` |
| GET | `/api/v1/groups/:id` | — |
| DELETE | `/api/v1/groups/:id` | — |

Default groups (Administrators, Members) → 401 on edit/delete.

---

## 9. Clients (System Admin only)

Permission: `clientManagement`. JWT must be a System Admin's token.

### Create client

```
POST /api/v1/clients
```

Body:
```json
{
  "name": "Acme Pharma",
  "clientCode": "ACME",
  "description": "...",
  "adminFirstName": "...",
  "adminLastName": "...",
  "adminUsername": "...",
  "adminEmail": "...",
  "adminLocale": "en",
  "maxLoginAttempts": 5,
  "accountLockDurationHours": 24,
  "passwordHistoryLimit": 5,
  "sessionInactivityTimeout": 30,
  "emailProvider": "SMTP",
  "smtpHost": "...",
  "smtpPort": 587,
  "smtpUser": "...",
  "smtpPassword": "...",
  "smtpFrom": "..."
}
```

`clientCode` is **required**, 4 uppercase chars/digits, **unique** across all
clients. Bootstrap admin receives a setup email.

### Update client

```
PUT /api/v1/clients/:id
```

`name` and `clientCode` are **immutable** — not in the schema.

---

## Field cheat sheet

| Type | Where used | Constraint |
|---|---|---|
| `id` (uuid) | most resources | RFC 4122 UUID |
| `id` (integer) | threshold profiles, scopes, data source types | positive integer |
| `clientCode` | `client` table | 4 chars, `[A-Z0-9]{4}` |
| `code` | threshold profile, scope, data source type | `[A-Z0-9][A-Z0-9_-]{1,63}`, auto-uppercased |
| `description` | many | ≤ 500 chars |
| `status` (enum) | many entities | `0` (inactive) or `1` (active) |
| `level` (RBAC) | role / permission | `0` NONE, `1` READ, `2` WRITE, `3` FULL |
| `operator` | threshold condition | `>=`, `<=`, `>`, `<`, `=`, `!=` |
| `sourceSystem` | data source, product browser | E.g. `AEMS`, `UAN` |

---

## Auth flow summary

```text
1. POST /api/v1/auth/login             → accessToken, refreshToken
2. GET  /api/v1/auth/session           → user, permissions (tree), role
3. <call any protected route with x-auth-token: accessToken>
4. When access token expires (401):
   POST /api/v1/auth/refresh
     body: { refreshToken }
   → new accessToken
5. POST /api/v1/auth/logout            → invalidates refresh token
```

---

## Permission lookups (FE → BE values)

The FE sends permission-level numbers (`0`, `1`, `2`, `3`); the BE returns
i18n keys for display.

| FE level | BE code | Display string (en) |
|:---:|---|---|
| 0 | NONE | None |
| 1 | READ | Read |
| 2 | WRITE | Write |
| 3 | FULL | Full |

`canEdit` / `canDelete` boolean flags appear on list/get responses for
users, roles, groups, threshold profiles, data sources. Use them to
hide action buttons — the BE enforces the rule again on the actual
mutation route.
