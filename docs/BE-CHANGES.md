# UltraSignal BE — Change Log (Pharmacovigilance modules)

Running journal of the BE work that landed in `fix/pb-source-system` and adjacent commits. Reads top-down chronologically; cross-references the doc owners (`fe-integration.md`, `DATA_MODEL.md`) where their contracts moved.

## 1. Product Browser

### 1.1 Endpoint

```
POST /api/v1/product-browser/search
```

One endpoint, two modes selected by the `type` field:

| `type` | Behaviour |
|---|---|
| `0` (default) | ILIKE search at one level (or `ALL`). Optional `filter` mode controls the wildcard shape. |
| `1` | Exact-match hierarchy walk. Anchors on a single term + level; returns siblings at every OTHER level. |

Permission: `productGroup` READ.

### 1.2 Request body

```jsonc
{
  "type": 0,
  "filter": "contains",
  "searchedValue": "paracetamol",
  "level": "INGREDIENT",
  "sourceSystem": "UAN"
}
```

| Field | Required | Notes |
|---|:---:|---|
| `type` | optional (default `0`) | `0` = search, `1` = hierarchy walk. |
| `filter` | optional (default `"contains"`) | `contains` / `startsWith` / `endsWith` / `exactMatch`. Only honoured for `type=0`; ignored under `type=1`. |
| `searchedValue` | ✅ | 1–255 chars. |
| `level` | ✅ | `INGREDIENT` / `PRODUCT_FAMILY` / `PRODUCT_NAME` / `TRADE_NAME` / `ALL`. `ALL` is invalid under `type=1`. |
| `sourceSystem` | **`type=1` only** | Joi `.when('type')` enforces required-on-hierarchy, optional-on-search. |

The conditional `sourceSystem` rule reflects what the controller actually needs:

- **`type=0` (search)** — when omitted, `baseQuery()` skips the `source_system =` WHERE clause and fans out across every upstream system in one shot. When supplied, the query stays scoped.
- **`type=1` (hierarchy walk)** — `sourceSystem` is required so the sibling-set stays inside the user's chosen upstream.

### 1.3 Response

```jsonc
{
  "ingredients": [{ "name": "...", "code": "...", "original_name": "...", "sourceSystem": "UAN" }],
  "pFamily":     [...],
  "pName":       [...],
  "tradeName":   [...]
}
```

| `type` | `level` | Populated arrays |
|---|---|---|
| 0 | INGREDIENT | ingredients |
| 0 | PRODUCT_FAMILY | pFamily |
| 0 | PRODUCT_NAME | pName |
| 0 | TRADE_NAME | tradeName |
| 0 | ALL | all four (parallel `Promise.all`) |
| 1 | INGREDIENT | pFamily |
| 1 | PRODUCT_FAMILY | ingredients + pName |
| 1 | PRODUCT_NAME | ingredients + pFamily + tradeName |
| 1 | TRADE_NAME | ingredients + pFamily + pName |

`sourceSystem` is echoed per item on every row, regardless of mode. The FE uses it to scope a subsequent hierarchy refine to the same upstream the user clicked.

### 1.4 Display vs. raw naming for Product / Trade

Search ILIKE matches the **raw** column (`product_name`, `trade_name`). The response carries the **display** value (`product_name_display`, `trade_name_display`) in `name` so the UI shows the polished label, while `original_name` carries the raw column value — exactly what the FE sends back as `searchedValue` on a follow-up `type=1` refine, which the BE matches with `WHERE pb.product_name = :value`.

### 1.5 Entity

`src/shared/db/entities/product-browser.entity.ts`. Read-only catalog populated by upstream ETL. Index on `source_system` for the WHERE clause. Functional `LOWER(ingredient_name)` index from the original DDL is left to manual SQL — the docstring spells out the recreation statement.

### 1.6 Files of interest

- `src/modules/product-browser/middleware/listProductBrowser.validation.ts` — Joi schema with the `.when('type')` rule on `sourceSystem`.
- `src/modules/product-browser/controllers/listProductBrowser.ts` — search + hierarchy helpers. `baseQuery(sourceSystem?)` conditionally scopes the WHERE; `baseQueryAllSources()` fans out across systems for hierarchy walks; `DISTINCT ON` adapts (single column when scoped, `name + source_system` when unscoped) so an ingredient that exists in both UAN and AEMS doesn't collapse to one row.

## 2. Product Groups

Saved groupings of catalog hierarchy picks. Each group has a stable `code` (unique per scope + client when not soft-deleted) and a collection of members. A member is either a hierarchy pick (`member_type='product'`) or a reference to another group (`member_type='group'`).

### 2.1 Schema

```
product_group
  product_group_id           int4 PK (identity)
  code                       text NOT NULL
  name                       text NOT NULL
  scope_id                   int2 NOT NULL → scope.scope_id
  client_id                  int8 NULL          -- multi-tenant owner
  enterprise_id              int8 NULL          -- optional sub-tenant
  deleted                    bool DEFAULT false
  created_by / created_at / updated_by / updated_at

UNIQUE (COALESCE(client_id, 0), scope_id, code) WHERE NOT deleted

product_group_member
  product_group_member_id    int4 PK (identity)
  product_group_id           int4 NOT NULL → product_group.product_group_id ON DELETE CASCADE
  member_type                text ('product' | 'group')
  source_system              text NULL          -- product members only
  level                      text NULL          -- product members only
  code                       text NULL          -- catalog code (products) or child group code (group)
  parent_product_group_id    int4 NULL → product_group.product_group_id   -- group members only
  name                       text NULL
  deleted                    bool DEFAULT false
  tgt_insert_date_time       timestamptz DEFAULT now()

CHECK (
  (member_type='product' AND level IS NOT NULL AND source_system IS NOT NULL AND name IS NOT NULL AND parent_product_group_id IS NULL)
  OR
  (member_type='group'   AND code IS NOT NULL AND parent_product_group_id IS NOT NULL AND level IS NULL AND source_system IS NULL)
)
INDEX  ix_pgm_group  (product_group_id)
INDEX  ix_pgm_parent (parent_product_group_id) WHERE parent_product_group_id IS NOT NULL
```

### 2.2 Entities

- `src/shared/db/entities/product-group.entity.ts` — `ProductGroup` with FK on `scope`, soft-delete column, audit cols, one-to-many `members`.
- `src/shared/db/entities/product-group-member.entity.ts` — `ProductGroupMember` with FKs on `productGroup` (CASCADE) and `parentProductGroup`. The DDL's CHECK constraint is expressed via two `@Check` decorators — one enforces the disjunction between the two shapes; the other restricts `member_type` to the two known values.

Both registered in `src/shared/db/entities/all_entities.constant.ts`.

### 2.3 Seed

`src/shared/helpers/system/seedProductGroups.ts`. Idempotent, upserts by `productGroupId` / `productGroupMemberId` so PKs stay stable across boots and downstream FKs don't drift. Resolves `scope_id` by `code` at runtime (the CSV's literal `scope_id=2` would be wrong on a fresh DB where `org` got a different id).

Hooked into the seed transaction in `src/shared/db/index.ts` after `seedScopes` / `seedThresholdProfiles` / `seedStatisticalConstantsProfiles`.

Fixture content (lifted from `product_group_*.csv`):

- Group 1 `ONCOLOGY_PORTFOLIO` (org scope, client 9999, enterprise 13) — one ingredient member (`Abacavir hydrochloride` from UAN) + one nested-group reference to `BIOSIMILARS`.
- Group 2 `BIOSIMILARS` (org scope, client 9999, enterprise 13) — three AEMS ingredients (`adalimumab`, `adalimumab-aacf`, `adalimumab-adbm`).

### 2.4 List endpoint

```
GET /api/v1/product-groups
  ?page=1
  &limit=20
  &filter=<URL-encoded JSON>
  &sort=createdAt:desc
  &includeMembers=false
```

Permission: `productGroup` READ.

Filter blob keys (all optional, present-only):

| Key | SQL |
|---|---|
| `name` | ILIKE %term% on `name` |
| `code` | ILIKE %term% on `code` |
| `scopeId` | exact match (numeric) |
| `clientId` | exact match (bigint string) |
| `createdDateFrom` | `created_at >= :from` |
| `createdDateTo` | `created_at <= :to` |

Sort field whitelist: `name`, `code`, `scopeId`, `createdAt`. Default `createdAt:desc`. Malformed JSON in `filter` is logged + ignored (matches the threshold-profiles convention so a bad FE state doesn't break the page).

Soft-deleted rows are filtered out at the SQL layer — they never appear in user-facing lists.

Response:

```jsonc
{
  "status": true,
  "code": 200,
  "message": "product_group.list_fetched",
  "data": {
    "count": 2,
    "productGroups": [
      {
        "productGroupId": 1,
        "code": "ONCOLOGY_PORTFOLIO",
        "name": "Oncology portfolio",
        "scopeId": 2,
        "scope": { "code": "org", "displayName": "Organization" },
        "clientId": "9999",
        "enterpriseId": "13",
        "deleted": false,
        "createdAt": "2026-06-10T09:07:03.946Z",
        "updatedAt": null,
        "memberCount": 2,
        "canEdit": true,
        "canDelete": true
      }
    ]
  }
}
```

- `count` is the total filtered row count (used by the FE paginator).
- `memberCount` is computed via a batch `SELECT COUNT(*) ... GROUP BY product_group_id` keyed by `IN (...)` on the page's group ids — one round trip total, no N+1.
- `includeMembers=true` swaps the count call for a full member fetch and inlines `members: ProductGroupMember[]` per group.
- `canEdit` / `canDelete` are derived per row: `scope.code !== 'system'` is mutable; system rows are read-only. Future write endpoints will enforce the same rule again at mutation time.

### 2.5 Module layout

```
src/modules/product-groups/
├── controllers/
│   └── listProductGroup.ts
├── middleware/
│   └── listProductGroup.validation.ts
└── product-groups.routes.ts
```

Mounted by `src/server.ts` at `/api/v1/product-groups`. Write/update/delete endpoints will land later — the route file has the shape ready for them.

### 2.6 Response messages

Added to `src/shared/constants/response.messages.ts`:

```typescript
export const PRODUCT_GROUP = {
  LIST_FETCHED: 'product_group.list_fetched',
  FETCHED:      'product_group.fetched',
  NOT_FOUND:    'product_group.not_found',
};
```

## 3. What's still pending

- Write endpoints on `/api/v1/product-groups` (POST / PUT / DELETE) + member management. The validator skeleton in this branch is list-only.
- The `description` column the FE list table renders today is derived from the group's `code` (see `ProductGroupService.toFeRow` on the FE) because the BE table has no `description` column yet. When the BE schema grows one, drop the temporary mapping.
- Status filter on the FE list page was replaced with a **Scope** filter (mirrors detection profiles). The BE table doesn't have a `status` / `is_active` column today — only `deleted` (soft-delete), which is filtered out wholesale at the SQL layer. If status needs to become a user-facing filter, the table needs an `is_active` column + a corresponding filter key.
- `fe-integration.md` still describes `sourceSystem` as required on both `type=0` and `type=1`. Once this branch merges, update §3 (Product Browser) to reflect the conditional rule.

## 4. FE consumers

- **Product picker dialog** (`src/app/common/components/dialogs/product-selector-dialog/`) — calls `POST /api/v1/product-browser/search`. Mode 0 (Search button) omits `sourceSystem`; Mode 1 (card click) reads the clicked option's per-item `sourceSystem` and forwards it.
- **Add Product Group form** (`src/app/modules/product-groups/components/add-product-group/`) — embeds the picker; criteria emitted on Apply.
- **List Product Group screen** (`src/app/modules/product-groups/components/list-product-group/`) — calls `GET /api/v1/product-groups`. Mapping layer in `ProductGroupService.toFeRow` bridges BE shape to the FE's `ProductGroup` contract.
