# Data Source — API Contract

Frontend integration guide for the Data Source feature (under Business
Configuration). Covers the type catalog, the per-client CRUD, and the
test-connection probe.

---

## Quick reference

| # | Method | URL | Permission | Notes |
|---|---|---|---|---|
| 1 | GET    | `/api/v1/data-source-types`           | `dataSource` READ  | Dropdown source (AEMS, UAN) |
| 2 | POST   | `/api/v1/data-sources/test-connection`| `dataSource` WRITE | "Test Connection" button, no persistence |
| 3 | POST   | `/api/v1/data-sources`                | `dataSource` WRITE | Create |
| 4 | GET    | `/api/v1/data-sources`                | `dataSource` READ  | Paginated list |
| 5 | GET    | `/api/v1/data-sources/:id`            | `dataSource` READ  | Detail (with `type` joined) |
| 6 | PUT    | `/api/v1/data-sources/:id`            | `dataSource` WRITE | Partial update |
| 7 | DELETE | `/api/v1/data-sources/:id`            | `dataSource` FULL  | Soft delete |

---

## Auth

Every endpoint requires:

| Header | Value |
|---|---|
| `x-auth-token` | JWT from `/api/v1/auth/login` |
| `Content-Type` | `application/json` (on POST / PUT) |

The caller's JWT must carry the `dataSource` permission at the required
level. If not, the response is `401`:

```json
{ "status": false, "code": 401, "message": "generic.unauthorized" }
```

All endpoints are tenant-scoped automatically — the JWT carries the
client id, and every query filters by it. The FE never names a client.

---

## Standard response shape

Every response follows the platform's `sendResponse` shape:

```jsonc
{
  "status": true | false,
  "code": <http-status-code>,
  "message": "<i18n-key or plain string>",
  "data": <payload or undefined>,
  "meta": {
    "requestId": "<uuid>",
    "durationMs": 12
  }
}
```

`meta` is added by middleware and is the same on every response — omitted
from per-endpoint examples below for brevity.

---

## 1. List Data Source Types

Populates the **Type** dropdown on the Add / Edit Data Source form.

```
GET /api/v1/data-source-types
```

### Response — `200`

```json
{
  "status": true,
  "code": 200,
  "message": "data_source_type.list_fetched",
  "data": {
    "count": 2,
    "types": [
      {
        "id": "8c2e5b41-1e22-4a92-9bff-7c5edcfa9e10",
        "sourceId": 1,
        "name": "AEMS",
        "scope": "SYSTEM",
        "status": 1,
        "createdOn": "2026-06-11T10:46:06.512Z"
      },
      {
        "id": "f1d3a2b0-9b8e-4f56-a3c1-08e7a2f1b9a4",
        "sourceId": 2,
        "name": "UAN",
        "scope": "SYSTEM",
        "status": 1,
        "createdOn": "2026-06-11T10:46:06.518Z"
      }
    ]
  }
}
```

The FE sends back the **`id`** (UUID) when creating a Data Source, not
the `sourceId`. `sourceId` is just a friendly numeric label.

---

## 2. Test Connection

Probes a Postgres database with the supplied credentials. No data is
persisted; this is purely for the **"Test Connection"** button on the
form. Use BEFORE submitting Create / Update so the user gets immediate
feedback.

```
POST /api/v1/data-sources/test-connection
```

### Request body

```json
{
  "host": "db.example.com",
  "port": 5432,
  "dbname": "production",
  "username": "ingest_user",
  "password": "<plaintext>",
  "schema": "public"
}
```

### Field rules

| Field | Type | Required | Constraints |
|---|---|:---:|---|
| `host` | string | ✅ | 1–255 chars |
| `port` | number | ✅ | integer, 1–65535 |
| `dbname` | string | ✅ | 1–128 chars |
| `username` | string | ✅ | 1–128 chars |
| `password` | string | ✅ | 1–256 chars |
| `schema` | string | ✅ | 1–64 chars, matches `^[A-Za-z_][A-Za-z0-9_]*$` |

### Probe sequence (server-side)

1. Open `pg.Client` with 5s connect timeout and 5s statement timeout
2. `SELECT 1` — confirms session works
3. `SELECT 1 FROM pg_namespace WHERE nspname = $1` — confirms schema exists
4. Always closes the connection (success or failure)

### Responses

**Success — `200`**
```json
{
  "status": true,
  "code": 200,
  "message": "data_source.connection_ok",
  "data": { "ok": true }
}
```

**Schema not found — `404`**
```json
{
  "status": false,
  "code": 404,
  "message": "data_source.schema_not_found"
}
```

**Validation failure — `400`** (one example)
```json
{
  "status": false,
  "code": 400,
  "message": "Port must be between 1 and 65535"
}
```

**Connection / auth failure — `400`**
The underlying Postgres error message is passed through so the user can
act on it. Common examples:

```json
{ "status": false, "code": 400, "message": "password authentication failed for user \"ingest_user\"" }
{ "status": false, "code": 400, "message": "connect ECONNREFUSED 10.0.0.5:5432" }
{ "status": false, "code": 400, "message": "database \"production\" does not exist" }
{ "status": false, "code": 400, "message": "Connection terminated due to connection timeout" }
```

### Security notes
- Passwords are **never logged**. Only `username@host:port/dbname` lands in server logs.
- The endpoint **does not store** any of the supplied credentials. Saving requires a separate `POST /api/v1/data-sources` call (and currently the entity doesn't carry connection columns — see "Out of scope" at the bottom).

---

## 3. Create Data Source

```
POST /api/v1/data-sources
```

### Request body

```json
{
  "name": "Production AEMS Feed",
  "description": "Primary AE feed from AEMS cluster",
  "typeId": "8c2e5b41-1e22-4a92-9bff-7c5edcfa9e10"
}
```

### Field rules

| Field | Type | Required | Constraints |
|---|---|:---:|---|
| `name` | string | ✅ | 2–64 chars, starts with letter/number, allows letters, digits, spaces, `.` `_` `-`. **Unique per client.** |
| `description` | string \| null | optional | ≤ 500 chars |
| `typeId` | UUID | ✅ | Must be the `id` of an active row from `GET /data-source-types` |

### Success — `200`

```json
{
  "status": true,
  "code": 200,
  "message": "data_source.created",
  "data": {
    "id": "9f2b1c34-5d6e-7f80-91a2-b3c4d5e6f7a8",
    "name": "Production AEMS Feed",
    "description": "Primary AE feed from AEMS cluster",
    "typeId": "8c2e5b41-1e22-4a92-9bff-7c5edcfa9e10",
    "clientId": "494ef425-769c-4a6c-aed0-db5daf077f36",
    "clientName": "kk",
    "status": 1,
    "createdOn": "2026-06-11T10:46:06.512Z"
  }
}
```

### Errors

| Code | When | Message |
|---|---|---|
| 400 | Joi validation failed | `"Name is required"`, etc. |
| 404 | `typeId` doesn't exist or is inactive | `data_source.type_not_found` |
| 405 | A Data Source with the same `name` already exists in this client | `data_source.already_exists` |

---

## 4. List Data Sources

```
GET /api/v1/data-sources
```

### Query parameters

| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | number | 1 | 1-indexed |
| `limit` | number | `MAX_ROW` (env) | Page size |
| `filter` | JSON string | — | See below |
| `sort` | string | `createdOn:desc` | `<field>:asc` or `<field>:desc`. Allowed fields: `name`, `status`, `createdOn` |

### `filter` shape (URL-encoded JSON)

```jsonc
{
  "name": "production",           // ILIKE %term%
  "description": "primary",       // ILIKE %term%
  "typeId": "8c2e5b41-...",       // exact match
  "status": 1,                    // 0 or 1
  "createdDateFrom": "2026-01-01",
  "createdDateTo": "2026-12-31"
}
```

All fields optional. Malformed JSON is silently ignored (the list still returns, just unfiltered).

### Response — `200`

```json
{
  "status": true,
  "code": 200,
  "message": "data_source.list_fetched",
  "data": {
    "count": 2,
    "dataSources": [
      {
        "id": "9f2b...",
        "name": "Production AEMS Feed",
        "description": "...",
        "typeId": "8c2e...",
        "clientId": "...",
        "clientName": "kk",
        "status": 1,
        "createdOn": "...",
        "type": {
          "id": "8c2e...",
          "sourceId": 1,
          "name": "AEMS",
          "scope": "SYSTEM",
          "status": 1
        },
        "typeName": "AEMS",
        "typeSourceId": 1
      }
    ]
  }
}
```

`type` is the joined relation. `typeName` / `typeSourceId` are flat
convenience fields if you prefer not to traverse the relation in the FE.

---

## 5. Get Data Source

```
GET /api/v1/data-sources/:id
```

### Response — `200`

Same shape as one entry in the list response (with the `type` relation
joined). Returns `404 data_source.not_found` if the row doesn't exist or
belongs to a different client.

---

## 6. Update Data Source

```
PUT /api/v1/data-sources/:id
```

### Request body

All fields optional except `id`. Fields not sent keep their current value.

```json
{
  "id": "9f2b1c34-5d6e-7f80-91a2-b3c4d5e6f7a8",
  "name": "AEMS Production v2",
  "description": "Updated description",
  "typeId": "8c2e5b41-1e22-4a92-9bff-7c5edcfa9e10",
  "status": 0
}
```

### Rules

- `id` in body must match `:id` in path (both required for compatibility)
- `name` (if sent) must remain unique within the client — uses `Not(id)` so submitting the unchanged name is fine
- `typeId` (if sent) must reference an active type
- `status`: `0` (inactive) or `1` (active)

### Responses

Same shape as Create. Same error cases (400 / 404 / 405 / 500).

---

## 7. Delete Data Source

```
DELETE /api/v1/data-sources/:id
```

Soft delete — sets `deletedOn` and `deletedBy`. The row is hidden from
all list / get queries afterward but kept in the DB for audit.

### Response — `200`

```json
{
  "status": true,
  "code": 200,
  "message": "data_source.deleted"
}
```

`404 data_source.not_found` if the row doesn't exist or belongs to a
different client.

---

## End-to-end flow — Add Data Source screen

```text
   ┌─────────────────────────────────────────────────────────┐
   │  1. Mount screen                                        │
   │     GET /api/v1/data-source-types                       │
   │     → render Type dropdown                              │
   └─────────────────────────────────────────────────────────┘
                              │
                              ▼
   ┌─────────────────────────────────────────────────────────┐
   │  2. User fills the form:                                │
   │     name, description, type, host, port, dbname,        │
   │     username, password, schema                          │
   └─────────────────────────────────────────────────────────┘
                              │
                              ▼
   ┌─────────────────────────────────────────────────────────┐
   │  3. User clicks "Test Connection"                       │
   │     POST /api/v1/data-sources/test-connection           │
   │       body: { host, port, dbname, username,             │
   │               password, schema }                        │
   │     → show success / show error inline                  │
   └─────────────────────────────────────────────────────────┘
                              │
                              ▼
   ┌─────────────────────────────────────────────────────────┐
   │  4. User clicks "Save"                                  │
   │     POST /api/v1/data-sources                           │
   │       body: { name, description, typeId }               │
   │     → navigate back to list view                        │
   └─────────────────────────────────────────────────────────┘
```

⚠ **Step 3 only validates connectivity** — it does not store anything.
Connection details (host/port/etc.) are NOT currently saved with the
Data Source. See "Out of scope" below.

---

## Edit screen

```text
GET /api/v1/data-sources/:id  → prefill form fields
GET /api/v1/data-source-types → repopulate the Type dropdown
... user edits fields ...
POST /api/v1/data-sources/test-connection (optional)
PUT /api/v1/data-sources/:id → save
```

---

## List screen

```text
GET /api/v1/data-sources?page=1&limit=20&sort=createdOn:desc
   ?filter={"name":"prod","typeId":"<uuid>"}
```

Render the table from `data.dataSources[]`. Use `data.count` for total
records. `typeName` and `typeSourceId` are inline convenience fields.

---

## Common error responses

Every endpoint can return these:

| Code | Meaning | Example message |
|---|---|---|
| 400 | Validation failed | `"Name is required"`, `"Port must be between 1 and 65535"` |
| 401 | JWT missing/expired | `"generic.unauthorized"` |
| 401 | Permission level too low | `"generic.unauthorized"` |
| 404 | Row not found (or belongs to different client) | `"data_source.not_found"` |
| 405 | Duplicate name within client | `"data_source.already_exists"` |
| 500 | Server error | `"generic.server_error"` |

---

## i18n message keys

| Key | English |
|---|---|
| `data_source.created` | Data source created successfully |
| `data_source.updated` | Data source updated successfully |
| `data_source.deleted` | Data source deleted successfully |
| `data_source.fetched` | Data source fetched successfully |
| `data_source.list_fetched` | Data sources fetched successfully |
| `data_source.not_found` | Data source not found |
| `data_source.already_exists` | Data source with this name already exists |
| `data_source.type_not_found` | Selected type not found |
| `data_source.connection_ok` | Connection successful |
| `data_source.schema_not_found` | Schema not found in the target database |
| `data_source_type.list_fetched` | Data source types fetched successfully |

(The FE should resolve these against its locale dictionary — the BE
returns the key, not the resolved string.)

---

## Permission model

The `dataSource` permission sits under **Business Configuration** in
the role catalog. A role's level controls what verbs it can call:

| Level | Number | Allows |
|---|:---:|---|
| NONE | 0 | Nothing — every endpoint returns 401 |
| READ | 1 | `GET` (list, detail, types) |
| WRITE | 2 | `GET` + `POST` (create, test-connection) + `PUT` (update) |
| FULL | 3 | `GET` + `POST` + `PUT` + `DELETE` |

Default tenant Administrator gets `FULL` at client onboarding.
Members and other custom roles start at `NONE`; tenant Admin grants
levels via the role editor.

---

## Out of scope (not built yet)

The current `DataSource` entity stores only:
`id, name, description, typeId, clientId, status, audit fields`.

It does **NOT** store `host, port, dbname, username, password, schema`.
The Test Connection endpoint accepts those fields and probes them, but
nothing persists them. If you want the form's connection details to
**save with** the Data Source row (so a user can reopen Edit and see
them prefilled), tell the BE team — they need to add the columns,
encrypt the password before storage, and pipe the fields through
`POST /data-sources` / `PUT /data-sources/:id`.

Other items not built:
- **Bulk delete** (`POST /data-sources/bulk-delete`)
- **SSL toggle** on test-connection (required for Supabase / RDS-with-enforce-SSL)
- **Connection pool** for ingestion (this is just a probe, not an ongoing connection)

---

## Quick reference card

```text
GET    /api/v1/data-source-types               → list types (AEMS, UAN)
POST   /api/v1/data-sources/test-connection    → probe DB, no persistence
                                                 body: host, port, dbname,
                                                       username, password, schema

POST   /api/v1/data-sources                    → create
                                                 body: name, description?, typeId
GET    /api/v1/data-sources                    → list (page, limit, filter, sort)
GET    /api/v1/data-sources/:id                → detail (with `type` joined)
PUT    /api/v1/data-sources/:id                → update (all fields optional except id)
DELETE /api/v1/data-sources/:id                → soft delete

Auth:      x-auth-token: <jwt>
Permission: dataSource at level READ / WRITE / FULL (see endpoint table)
```
