# Add Role — API Contract

This document describes the wire format for creating a new role with
permission grants in UltraSignal.

---

## Endpoint

```
POST  /api/v1/roles
```

### Headers

| Header | Required | Notes |
|---|:---:|---|
| `x-auth-token` | ✅ | JWT issued by `/api/v1/auth/login` or `/api/v1/auth/refresh` |
| `Content-Type` | ✅ | `application/json` |

### Permission required

Caller's JWT must carry `roles` with **level ≥ WRITE (2)**. Returns `401` otherwise.

---

## Request body

```jsonc
{
  "name": "Senior Analyst",
  "description": "Analysts who also moderate user groups",
  "selectedPermissions": [
    { "permissionId": "<uuid-of-users-permission>",        "level": 1 },
    { "permissionId": "<uuid-of-groups-permission>",       "level": 2 },
    { "permissionId": "<uuid-of-productGroup-permission>", "level": 3 },
    { "permissionId": "<uuid-of-alertConfiguration-perm>", "level": 2 }
  ]
}
```

### Field reference

| Field | Type | Required | Constraints |
|---|---|:---:|---|
| `name` | string | ✅ | 2–64 chars, starts with letter/number, allows letters, digits, spaces, `.` `_` `-`. **Unique per client** — Administrator of Acme can have an "Analyst" role independent of Beta Pharma's "Analyst". |
| `description` | string \| null | optional | Free text, ≤ 500 chars. Pass `null` or omit if not provided. |
| `selectedPermissions` | array | ✅ | **At least 1 entry** required. Each entry shape: `{ permissionId: string (uuid), level: number }`. |
| `selectedPermissions[].permissionId` | UUID | ✅ | The `id` of a row in the `permission` table. Get these from `GET /api/v1/permissions`. |
| `selectedPermissions[].level` | number | ✅ | `0 = NONE` (skipped silently — no row stored), `1 = READ`, `2 = WRITE`, `3 = FULL`. Entries outside `1..3` are ignored. |

### Level semantics

| Value | Code | Effect |
|:---:|---|---|
| `0` | `NONE` | Permission not granted. **No row inserted in `role_permission_mapping`.** Equivalent to omitting the entry entirely. |
| `1` | `READ` | View/list only. Passes routes gated at `ACCESS.READ`. |
| `2` | `WRITE` | Create + edit + everything `READ` allows. |
| `3` | `FULL` | Delete + admin actions + everything `WRITE` allows. |

**Rule:** higher levels imply all lower levels — a single FULL row makes the role pass every READ and WRITE check on that permission.

---

## Success response — `201` (or `200 SUCCESS` per the project's `sendResponse` shape)

```json
{
  "status": true,
  "code": 200,
  "message": "role.created",
  "data": {
    "id": "8c2e5b41-1e22-4a92-9bff-7c5edcfa9e10",
    "name": "Senior Analyst",
    "description": "Analysts who also moderate user groups",
    "scope": "ORG",
    "clientId": "494ef425-769c-4a6c-aed0-db5daf077f36",
    "clientName": "kk",
    "isDefault": 0,
    "status": 1,
    "createdOn": "2026-06-09T18:41:12.512Z"
  }
}
```

Note the response does **not** echo the mapping rows. To read them back, hit:

```
GET  /api/v1/roles/:id
```

which returns the role with its `permissions: [...]` array enriched with each grant's parent chain.

---

## Error responses

### `400 — validation failure`

```json
{
  "status": false,
  "code": 400,
  "message": "At least one permission must be selected"
}
```

Common causes:
- `selectedPermissions` is empty or missing
- `name` is missing, too short, or fails the name pattern
- `description` exceeds 500 chars

### `401 — caller lacks `roles` WRITE`

```json
{
  "status": false,
  "code": 401,
  "message": "generic.unauthorized"
}
```

Server log line will read:
```
VerifyPermission: blocked — wanted roles >= 2, user has <X>
```

### `405 — duplicate name in the same client`

```json
{
  "status": false,
  "code": 405,
  "message": "role.already_exists"
}
```

A role with the same `name` already exists for this client. Names must be unique per-client (different clients can share names).

### `500 — server error`

```json
{
  "status": false,
  "code": 500,
  "message": "generic.server_error"
}
```

DB constraint violation, transaction failure, etc. Check server logs.

---

## End-to-end flow (Add Role screen)

The FE needs three endpoints to render the Add Role screen and submit the form:

```text
   ┌─────────────────────────────────────────────────────────┐
   │  1. GET /api/v1/access-levels                           │
   │     → [{ value: 0, code: "NONE",  label: "None"  },     │
   │        { value: 1, code: "READ",  label: "Read"  },     │
   │        { value: 2, code: "WRITE", label: "Write" },     │
   │        { value: 3, code: "FULL",  label: "Full"  }]     │
   │     used to render the radio-button COLUMNS             │
   └─────────────────────────────────────────────────────────┘
                              │
                              ▼
   ┌─────────────────────────────────────────────────────────┐
   │  2. GET /api/v1/permissions?scope=ORG                   │
   │     → modules → submodules (each with name/value/status)│
   │     used to render the ROWS                             │
   │     all levels start at 0 (NONE) in the UI              │
   └─────────────────────────────────────────────────────────┘
                              │
                              ▼
   ┌─────────────────────────────────────────────────────────┐
   │  3. User picks levels per row, types name/description   │
   │                                                         │
   │     Click "Save" →                                      │
   │                                                         │
   │     POST /api/v1/roles                                  │
   │       body: { name, description, selectedPermissions }  │
   └─────────────────────────────────────────────────────────┘
```

### Worked example — `selectedPermissions` payload construction

Suppose the FE has these in state after the Administrator picks levels in the editor:

| Permission row (from catalog)               | permissionId                            | Picked level |
|---------------------------------------------|-----------------------------------------|:------------:|
| Home                                         | `a1b2…0001`                             | 1 (Read)     |
| User Management → Users                      | `a1b2…0002`                             | 0 (None) ⨯   |
| User Management → Groups                     | `a1b2…0003`                             | 2 (Write)    |
| User Management → Roles                      | `a1b2…0004`                             | 1 (Read)     |
| Business Config → Product Group              | `a1b2…0005`                             | 3 (Full)     |
| Business Config → Event Group                | `a1b2…0006`                             | 0 (None) ⨯   |
| Signaling → Alert Configuration              | `a1b2…0007`                             | 2 (Write)    |

The FE should send **only the non-NONE entries** (`level > 0`):

```json
{
  "name": "Lead Analyst",
  "description": "Mixed responsibilities — reads users, manages groups",
  "selectedPermissions": [
    { "permissionId": "a1b2…0001", "level": 1 },
    { "permissionId": "a1b2…0003", "level": 2 },
    { "permissionId": "a1b2…0004", "level": 1 },
    { "permissionId": "a1b2…0005", "level": 3 },
    { "permissionId": "a1b2…0007", "level": 2 }
  ]
}
```

Sending entries with `level: 0` is harmless — the backend filters them out — but trims request size to skip them client-side.

### What the backend does on the request

1. Validates the body (Joi schema)
2. Checks `name` is unique within the client
3. Opens a transaction
4. Inserts the `role` row (scope = `ORG`, isDefault = 0, status = 1, clientId from JWT)
5. Filters `selectedPermissions` to `level >= 1`
6. Inserts one `role_permission_mapping` row per filtered entry
7. Commits the transaction
8. Returns the saved role

All steps happen in one transaction — if any step fails, no partial role is left behind.

---

## Update Role — same body shape, different URL

```
PUT  /api/v1/roles/:id
```

Body is identical to POST. Behavior difference:

- If `selectedPermissions` is included, all existing mappings for the role are **deleted first**, then the new set is inserted (wholesale replace, single transaction).
- If `selectedPermissions` is **omitted**, mappings are untouched — only the metadata (`name`, `description`, `status`) updates.

This means a "remove this permission" operation is just sending the new full list without that entry — same as the FE state after the user un-checks it.

---

## Read for the Update screen

When the Administrator clicks **Edit Role**, the FE should call:

```
GET  /api/v1/permissions?scope=ORG&roleId=<that-role-uuid>
```

The response is the same catalog shape as above, but every submodule (and leaf-only module) now has a `level` field showing the role's current level on it (`0` if no mapping). The FE pre-selects the matching radio button per row.

```jsonc
{
  "modules": [
    {
      "value": "userManagement",
      "name": "User Management",
      "submodules": [
        { "value": "roles",  "name": "Roles",  "level": 1 },
        { "value": "groups", "name": "Groups", "level": 2 },
        { "value": "users",  "name": "Users",  "level": 0 }   // not granted
      ]
    }
  ]
}
```

The FE then renders the form with the correct selections, the user adjusts, and submits the updated `selectedPermissions` via `PUT /api/v1/roles/:id`.

---

## Edge cases

| Case | Behavior |
|---|---|
| `selectedPermissions` contains a `permissionId` that doesn't exist | The row gets inserted; FK constraint will fail at COMMIT → 500. Validate on the FE by only sending IDs from the catalog response. |
| `selectedPermissions` contains a `permissionId` from a different scope | Allowed by the schema (catalog scope isn't checked at insert). Avoid by filtering catalog responses to `scope=ORG` before letting users pick. |
| Trying to create a role named "Administrator" or "Member" | Will fail with `role.already_exists` because the default seed roles exist with those names. Pick a different name. |
| `name` differs only in case (e.g. "analyst" vs "Analyst") | Uniqueness is currently case-sensitive — both rows succeed. If you want case-insensitive uniqueness, that's a separate change. |
| Creating a role with no `selectedPermissions` | Blocked by validation (`min: 1`). Roles must grant at least one permission. |
| Trying to set `isDefault = 1` via the request | Ignored — the controller hardcodes `isDefault = 0`. Default roles can only be created via the seed flow. |

---

## Quick reference card

```text
POST /api/v1/roles
  body: { name, description?, selectedPermissions[{permissionId, level}] }
  needs: roles.WRITE
  returns: role row
  → mapping rows inserted only for level >= 1

PUT /api/v1/roles/:id
  body: same as POST (selectedPermissions optional)
  needs: roles.WRITE
  → if selectedPermissions present, ALL existing mappings replaced

GET /api/v1/permissions?scope=ORG[&roleId=<uuid>]
  needs: any authenticated user
  → catalog tree; with roleId, each row carries the role's current level

GET /api/v1/access-levels
  needs: any authenticated user
  → [None, Read, Write, Full] catalog for the level columns

GET /api/v1/roles/:id
  needs: roles.READ
  → role + its mappings with parent-chain on each granted permission
```
