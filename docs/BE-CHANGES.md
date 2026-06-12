# UltraSignal BE — `fix/pb-source-system` Change Log

Comprehensive reference for the BE work landed on this branch. Every file the branch creates or modifies appears below with its full current source so this doc functions as the canonical record — no need to cross-reference git for a code review.

**Branch:** `fix/pb-source-system` (off `main`).

**Commits on branch:**

```
bf83195 fix(product-browser): sourceSystem required only on type=1
675fa44 feat(product-groups): entities + seed + list endpoint
            (subsequent uncommitted work expands this with get / update / delete
             endpoints, description + is_enabled columns, scope=org enforcement,
             status filter, and canEdit / canDelete row flags)
```

**Module coverage:**

1. Product Browser — search endpoint contract updates
2. Product Groups — entities, seed, CRUD endpoints, response messages, route mounting
3. Shared changes — `all_entities.constant.ts`, `shared/db/index.ts`, `server.ts`, `shared/constants/response.messages.ts`

---

## 1. Product Browser

`POST /api/v1/product-browser/search` — single endpoint, two modes:

| `type` | Behaviour |
|---|---|
| `0` (default) | ILIKE search at one level (or `ALL`). `filter` controls the wildcard shape (`contains` / `startsWith` / `endsWith` / `exactMatch`). |
| `1` | Exact-match hierarchy walk. Anchors on one term + level; returns siblings at every OTHER level. |

Permission: `productGroup` READ.

### 1.1 Validator (full source)

**File:** `src/modules/product-browser/middleware/listProductBrowser.validation.ts`

```typescript
/**
 * SearchProductBrowserValidation — validates the POST search payload.
 *
 *   POST /api/v1/product-browser/search
 *   {
 *     "type": 0 | 1,
 *     "filter": "contains" | "startsWith" | "endsWith" | "exactMatch",
 *     "searchedValue": "paracetamol",
 *     "level": "INGREDIENT" | "PRODUCT_FAMILY" | "PRODUCT_NAME" |
 *              "TRADE_NAME" | "ALL",
 *     "sourceSystem": "UAN"
 *   }
 *
 * `type` mirrors UAN's two modes:
 *   0 = SEARCH — ILIKE the value at `level` (filter mode picks the
 *       wildcard shape — contains / startsWith / endsWith / exactMatch).
 *       `level=ALL` fans out to every category.
 *   1 = HIERARCHY — exact-match the value at `level`, walk the
 *       hierarchy and return related items at every OTHER level. The
 *       `filter` field is ignored under type=1 (hierarchy always uses
 *       `=`). Does NOT support `level=ALL`.
 *
 * Defaults: `type: 0`, `filter: 'contains'` — existing callers that
 * omit either keep behaving as a plain contains-search.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import { GENERIC } from '../../../shared/constants/response.messages';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

export const PRODUCT_BROWSER_LEVELS = [
  'INGREDIENT',
  'PRODUCT_FAMILY',
  'PRODUCT_NAME',
  'TRADE_NAME',
  'ALL',
] as const;

export type ProductBrowserLevel = (typeof PRODUCT_BROWSER_LEVELS)[number];

export const SEARCH_TYPE_SEARCH = 0;
export const SEARCH_TYPE_HIERARCHY = 1;
export type ProductBrowserSearchType =
  | typeof SEARCH_TYPE_SEARCH
  | typeof SEARCH_TYPE_HIERARCHY;

export const PRODUCT_BROWSER_FILTERS = [
  'contains',
  'startsWith',
  'endsWith',
  'exactMatch',
] as const;

export type ProductBrowserFilter = (typeof PRODUCT_BROWSER_FILTERS)[number];

const schema = Joi.object({
  type: Joi.number()
    .valid(SEARCH_TYPE_SEARCH, SEARCH_TYPE_HIERARCHY)
    .default(SEARCH_TYPE_SEARCH)
    .messages({
      'any.only': 'type must be 0 (search) or 1 (hierarchy)',
    }),
  filter: Joi.string()
    .valid(...PRODUCT_BROWSER_FILTERS)
    .default('contains')
    .messages({
      'any.only': `filter must be one of: ${PRODUCT_BROWSER_FILTERS.join(', ')}`,
    }),
  searchedValue: Joi.string().trim().min(1).max(255).required().messages({
    'string.empty': 'searchedValue is required',
    'any.required': 'searchedValue is required',
  }),
  level: Joi.string()
    .valid(...PRODUCT_BROWSER_LEVELS)
    .required()
    .messages({
      'any.only': `level must be one of: ${PRODUCT_BROWSER_LEVELS.join(', ')}`,
      'any.required': 'level is required',
    }),
  /**
   * sourceSystem is required ONLY for type=1 (hierarchy walk) — that
   * mode anchors on an exact term and the FE wants to scope siblings
   * to a single upstream system. For type=0 (ILIKE search) it's
   * optional; when omitted, the controller fans out across every
   * source_system so the user sees all matches in one shot.
   */
  sourceSystem: Joi.string()
    .trim()
    .min(1)
    .max(64)
    .when('type', {
      is: SEARCH_TYPE_HIERARCHY,
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .messages({
      'string.empty': 'sourceSystem is required',
      'any.required': 'sourceSystem is required for type=1 (hierarchy)',
    }),
}).custom((value, helpers) => {
  if (value.type === SEARCH_TYPE_HIERARCHY && value.level === 'ALL') {
    return helpers.error('any.invalid', {
      message:
        'level=ALL is not allowed with type=1 (hierarchy). Pick a specific level.',
    });
  }
  return value;
});

const SearchProductBrowserValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { error, value } = validateSchema(schema, req.body);
    if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);
    req.body = value;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default SearchProductBrowserValidation;
```

**What changed:**
- `PRODUCT_BROWSER_FILTERS` enum + `ProductBrowserFilter` type added so the validator accepts `contains` / `startsWith` / `endsWith` / `exactMatch`.
- `sourceSystem` is now `Joi.when('type')` — required for `type=1`, optional for `type=0`. Previously required for both.
- The `custom()` body keeps rejecting `level=ALL` under `type=1`.

### 1.2 Controller (full source)

**File:** `src/modules/product-browser/controllers/listProductBrowser.ts`

```typescript
/**
 * searchProductBrowser — POST search over the `product_browser`
 * reference catalog. Mirrors the UAN `getProductData` controller's
 * shape, dropping the country / language axes and using
 * `source_system` for the platform filter.
 *
 * Input (validated): `{ searchedValue, level, sourceSystem }`.
 *   level ∈ INGREDIENT | PRODUCT_FAMILY | PRODUCT_NAME | TRADE_NAME | ALL
 *
 * For one specific level, only that category's array is populated;
 * the others come back empty. For ALL, all four queries fan out in
 * parallel (Promise.all) and the response carries every category.
 *
 * `distinctOn(name col)` matches UAN — dedupes by the matched name
 * column so the FE doesn't see the same ingredient repeated once per
 * row in the underlying table. Postgres-specific; the entity columns
 * we project lean on it for `DISTINCT ON`.
 *
 * Result shape mirrors UAN's downstream contract:
 *   `{ name, code, original_name }` per item. `name` is the user-
 *   facing label, `code` is the stable id, `original_name` is the
 *   raw column value (used by some queries-by-example flows).
 *
 * Result limit is capped at `BROWSER_LIMIT` to keep the FE list
 * responsive. If the user types something very broad they'll see
 * the first N matches; narrowing the term refines the set.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  PRODUCT_BROWSER as PB_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ProductBrowser } from '../../../shared/db/entities/product-browser.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import {
  ProductBrowserFilter,
  ProductBrowserLevel,
  ProductBrowserSearchType,
  SEARCH_TYPE_HIERARCHY,
} from '../middleware/listProductBrowser.validation';

/**
 * Wraps the user's search term in the right wildcards for the chosen
 * filter mode. `ILIKE %term%` becomes `ILIKE term%` for startsWith etc.
 * Matches UAN's `ConvertFilteredValue` semantics one-for-one.
 */
const toFilteredTerm = (value: string, filter: ProductBrowserFilter): string => {
  switch (filter) {
    case 'startsWith':
      return `${value}%`;
    case 'endsWith':
      return `%${value}`;
    case 'exactMatch':
      return value;
    case 'contains':
    default:
      return `%${value}%`;
  }
};

const BROWSER_LIMIT = 50;

interface SearchedItem {
  name: string;
  code: string;
  original_name: string;
  // Present only on type=1 (hierarchy) responses. Type=0 (search) is
  // already filtered to one sourceSystem so the field is redundant
  // there — we omit it to keep the search payload lean.
  sourceSystem?: string;
}

interface SearchedResponse {
  ingredients: SearchedItem[];
  pFamily: SearchedItem[];
  pName: SearchedItem[];
  tradeName: SearchedItem[];
}

/**
 * Search-mode base query (type=0). When `sourceSystem` is provided
 * the search is scoped to that upstream system; when omitted the
 * query fans out across every source — matching the FE contract
 * where `sourceSystem` is optional for plain search and required
 * only for the hierarchy walk.
 */
const baseQuery = (sourceSystem?: string) => {
  const qb = AppDataSource.getRepository(ProductBrowser).createQueryBuilder(
    'pb',
  );
  if (sourceSystem) {
    qb.where('pb.source_system = :sourceSystem', { sourceSystem });
  }
  return qb;
};

/**
 * Hierarchy queries (type=1) do NOT filter by source_system — the same
 * ingredient / family / product name can exist in multiple upstream
 * systems (UAN, AEMS, ...) and the FE wants to see every related item
 * regardless of where it came from. Each row carries its own
 * `source_system` so the FE can label items by origin.
 */
const baseQueryAllSources = () =>
  AppDataSource.getRepository(ProductBrowser).createQueryBuilder('pb');

const queryIngredients = async (
  searchedValue: string,
  filter: ProductBrowserFilter,
  sourceSystem?: string,
): Promise<SearchedItem[]> => {
  const qb = baseQuery(sourceSystem).select([
    'pb.ingredient_id AS ingredient_id',
    'pb.ingredient_name AS ingredient_name',
    'pb.source_system AS source_system',
  ]);
  const termClause = 'pb.ingredient_name ILIKE :term';
  const params = { term: toFilteredTerm(searchedValue, filter) };
  if (sourceSystem) qb.andWhere(termClause, params);
  else qb.where(termClause, params);
  const rows = await qb
    .distinctOn(
      sourceSystem ? ['pb.ingredient_name'] : ['pb.ingredient_name', 'pb.source_system'],
    )
    .limit(BROWSER_LIMIT)
    .getRawMany();
  return rows
    .filter(r => r.ingredient_name)
    .map(r => ({
      name: r.ingredient_name,
      code: r.ingredient_id,
      original_name: r.ingredient_name,
      sourceSystem: r.source_system,
    }));
};

const queryFamily = async (
  searchedValue: string,
  filter: ProductBrowserFilter,
  sourceSystem?: string,
): Promise<SearchedItem[]> => {
  const qb = baseQuery(sourceSystem).select([
    'pb.family_id AS family_id',
    'pb.family_name AS family_name',
    'pb.source_system AS source_system',
  ]);
  const termClause = 'pb.family_name ILIKE :term';
  const params = { term: toFilteredTerm(searchedValue, filter) };
  if (sourceSystem) qb.andWhere(termClause, params);
  else qb.where(termClause, params);
  const rows = await qb
    .distinctOn(
      sourceSystem ? ['pb.family_name'] : ['pb.family_name', 'pb.source_system'],
    )
    .limit(BROWSER_LIMIT)
    .getRawMany();
  return rows
    .filter(r => r.family_name)
    .map(r => ({
      name: r.family_name,
      code: r.family_id,
      original_name: r.family_name,
      sourceSystem: r.source_system,
    }));
};

const queryProductName = async (
  searchedValue: string,
  filter: ProductBrowserFilter,
  sourceSystem?: string,
): Promise<SearchedItem[]> => {
  const qb = baseQuery(sourceSystem).select([
    'pb.product_id AS product_id',
    'pb.product_name AS product_name',
    'pb.product_name_display AS product_name_display',
    'pb.source_system AS source_system',
  ]);
  const termClause = 'pb.product_name ILIKE :term';
  const params = { term: toFilteredTerm(searchedValue, filter) };
  if (sourceSystem) qb.andWhere(termClause, params);
  else qb.where(termClause, params);
  const rows = await qb
    .distinctOn(
      sourceSystem ? ['pb.product_name'] : ['pb.product_name', 'pb.source_system'],
    )
    .limit(BROWSER_LIMIT)
    .getRawMany();
  return rows
    .filter(r => r.product_name)
    .map(r => ({
      name: r.product_name_display ?? r.product_name,
      code: r.product_id,
      original_name: r.product_name,
      sourceSystem: r.source_system,
    }));
};

const queryTradeName = async (
  searchedValue: string,
  filter: ProductBrowserFilter,
  sourceSystem?: string,
): Promise<SearchedItem[]> => {
  const qb = baseQuery(sourceSystem).select([
    'pb.trade_id AS trade_id',
    'pb.trade_name AS trade_name',
    'pb.trade_name_display AS trade_name_display',
    'pb.source_system AS source_system',
  ]);
  const termClause = 'pb.trade_name ILIKE :term';
  const params = { term: toFilteredTerm(searchedValue, filter) };
  if (sourceSystem) qb.andWhere(termClause, params);
  else qb.where(termClause, params);
  const rows = await qb
    .distinctOn(
      sourceSystem ? ['pb.trade_name'] : ['pb.trade_name', 'pb.source_system'],
    )
    .limit(BROWSER_LIMIT)
    .getRawMany();
  return rows
    .filter(r => r.trade_name)
    .map(r => ({
      name: r.trade_name_display ?? r.trade_name,
      code: r.trade_id,
      original_name: r.trade_name,
      sourceSystem: r.source_system,
    }));
};

// ─── Hierarchy walk helpers (type = 1) ─────────────────────────────
// Exact-match the value at one level, then SELECT the columns
// belonging to OTHER levels. DISTINCT ON keeps each cross-section
// unique. The caller fans the rows into the grouped response shape
// based on which level was the anchor.

interface IngredientHierarchyRow {
  family_id: string;
  family_name: string;
  source_system: string;
}
const hierarchyIngredient = async (
  searchedValue: string,
): Promise<IngredientHierarchyRow[]> => {
  return baseQueryAllSources()
    .select([
      'pb.family_id AS family_id',
      'pb.family_name AS family_name',
      'pb.source_system AS source_system',
    ])
    .where('pb.ingredient_name = :value', { value: searchedValue })
    .distinctOn(['pb.family_name', 'pb.source_system'])
    .limit(BROWSER_LIMIT)
    .getRawMany();
};

interface FamilyHierarchyRow {
  ingredient_id: string;
  ingredient_name: string;
  product_id: string;
  product_name: string;
  product_name_display: string | null;
  source_system: string;
}
const hierarchyFamily = async (
  searchedValue: string,
): Promise<FamilyHierarchyRow[]> => {
  return baseQueryAllSources()
    .select([
      'pb.ingredient_id AS ingredient_id',
      'pb.ingredient_name AS ingredient_name',
      'pb.product_id AS product_id',
      'pb.product_name AS product_name',
      'pb.product_name_display AS product_name_display',
      'pb.source_system AS source_system',
    ])
    .where('pb.family_name = :value', { value: searchedValue })
    .distinctOn(['pb.ingredient_name', 'pb.product_name', 'pb.source_system'])
    .limit(BROWSER_LIMIT)
    .getRawMany();
};

interface ProductHierarchyRow {
  ingredient_id: string;
  ingredient_name: string;
  family_id: string;
  family_name: string;
  trade_id: string;
  trade_name: string;
  trade_name_display: string | null;
  source_system: string;
}
const hierarchyProductName = async (
  searchedValue: string,
): Promise<ProductHierarchyRow[]> => {
  return baseQueryAllSources()
    .select([
      'pb.ingredient_id AS ingredient_id',
      'pb.ingredient_name AS ingredient_name',
      'pb.family_id AS family_id',
      'pb.family_name AS family_name',
      'pb.trade_id AS trade_id',
      'pb.trade_name AS trade_name',
      'pb.trade_name_display AS trade_name_display',
      'pb.source_system AS source_system',
    ])
    .where('pb.product_name = :value', { value: searchedValue })
    .distinctOn([
      'pb.ingredient_name',
      'pb.family_name',
      'pb.trade_name',
      'pb.source_system',
    ])
    .limit(BROWSER_LIMIT)
    .getRawMany();
};

interface TradeHierarchyRow {
  ingredient_id: string;
  ingredient_name: string;
  family_id: string;
  family_name: string;
  product_id: string;
  product_name: string;
  product_name_display: string | null;
  source_system: string;
}
const hierarchyTradeName = async (
  searchedValue: string,
): Promise<TradeHierarchyRow[]> => {
  return baseQueryAllSources()
    .select([
      'pb.ingredient_id AS ingredient_id',
      'pb.ingredient_name AS ingredient_name',
      'pb.family_id AS family_id',
      'pb.family_name AS family_name',
      'pb.product_id AS product_id',
      'pb.product_name AS product_name',
      'pb.product_name_display AS product_name_display',
      'pb.source_system AS source_system',
    ])
    .where('pb.trade_name = :value', { value: searchedValue })
    .distinctOn([
      'pb.ingredient_name',
      'pb.family_name',
      'pb.product_name',
      'pb.source_system',
    ])
    .limit(BROWSER_LIMIT)
    .getRawMany();
};

const searchProductBrowser = async (req: Request, res: Response) => {
  Logger.info('Search Product Browser request');

  const { type, filter, searchedValue, level, sourceSystem } = req.body as {
    type: ProductBrowserSearchType;
    filter: ProductBrowserFilter;
    searchedValue: string;
    level: ProductBrowserLevel;
    /** Optional under type=0, required under type=1 (Joi enforces). */
    sourceSystem?: string;
  };

  try {
    const result: SearchedResponse = {
      ingredients: [],
      pFamily: [],
      pName: [],
      tradeName: [],
    };

    if (type === SEARCH_TYPE_HIERARCHY) {
      // type=1 — hierarchy walk. Validator already rejected level=ALL.
      // Source filter is NOT applied here — the same ingredient/family/
      // product/trade name can exist in multiple upstream systems, so
      // each returned item carries its own `sourceSystem` and the FE
      // labels it by origin.
      switch (level) {
        case 'INGREDIENT': {
          const rows = await hierarchyIngredient(searchedValue);
          for (const r of rows) {
            if (r.family_name) {
              result.pFamily.push({
                name: r.family_name,
                code: r.family_id,
                original_name: r.family_name,
                sourceSystem: r.source_system,
              });
            }
          }
          break;
        }
        case 'PRODUCT_FAMILY': {
          const rows = await hierarchyFamily(searchedValue);
          for (const r of rows) {
            if (r.ingredient_name) {
              result.ingredients.push({
                name: r.ingredient_name,
                code: r.ingredient_id,
                original_name: r.ingredient_name,
                sourceSystem: r.source_system,
              });
            }
            if (r.product_name) {
              result.pName.push({
                name: r.product_name_display ?? r.product_name,
                code: r.product_id,
                original_name: r.product_name,
                sourceSystem: r.source_system,
              });
            }
          }
          break;
        }
        case 'PRODUCT_NAME': {
          const rows = await hierarchyProductName(searchedValue);
          for (const r of rows) {
            if (r.ingredient_name) {
              result.ingredients.push({
                name: r.ingredient_name,
                code: r.ingredient_id,
                original_name: r.ingredient_name,
                sourceSystem: r.source_system,
              });
            }
            if (r.family_name) {
              result.pFamily.push({
                name: r.family_name,
                code: r.family_id,
                original_name: r.family_name,
                sourceSystem: r.source_system,
              });
            }
            if (r.trade_name) {
              result.tradeName.push({
                name: r.trade_name_display ?? r.trade_name,
                code: r.trade_id,
                original_name: r.trade_name,
                sourceSystem: r.source_system,
              });
            }
          }
          break;
        }
        case 'TRADE_NAME': {
          const rows = await hierarchyTradeName(searchedValue);
          for (const r of rows) {
            if (r.ingredient_name) {
              result.ingredients.push({
                name: r.ingredient_name,
                code: r.ingredient_id,
                original_name: r.ingredient_name,
                sourceSystem: r.source_system,
              });
            }
            if (r.family_name) {
              result.pFamily.push({
                name: r.family_name,
                code: r.family_id,
                original_name: r.family_name,
                sourceSystem: r.source_system,
              });
            }
            if (r.product_name) {
              result.pName.push({
                name: r.product_name_display ?? r.product_name,
                code: r.product_id,
                original_name: r.product_name,
                sourceSystem: r.source_system,
              });
            }
          }
          break;
        }
      }
    } else {
      // type=0 — search. ILIKE on the chosen level's name column with
      // the wildcard shape determined by `filter` (contains by default).
      switch (level) {
        case 'INGREDIENT':
          result.ingredients = await queryIngredients(searchedValue, filter, sourceSystem);
          break;
        case 'PRODUCT_FAMILY':
          result.pFamily = await queryFamily(searchedValue, filter, sourceSystem);
          break;
        case 'PRODUCT_NAME':
          result.pName = await queryProductName(searchedValue, filter, sourceSystem);
          break;
        case 'TRADE_NAME':
          result.tradeName = await queryTradeName(searchedValue, filter, sourceSystem);
          break;
        case 'ALL': {
          const [ingredients, pFamily, pName, tradeName] = await Promise.all([
            queryIngredients(searchedValue, filter, sourceSystem),
            queryFamily(searchedValue, filter, sourceSystem),
            queryProductName(searchedValue, filter, sourceSystem),
            queryTradeName(searchedValue, filter, sourceSystem),
          ]);
          result.ingredients = ingredients;
          result.pFamily = pFamily;
          result.pName = pName;
          result.tradeName = tradeName;
          break;
        }
      }
    }

    sendResponse(res, true, CODE.SUCCESS, PB_MSG.LIST_FETCHED, result);
  } catch (error) {
    Logger.error(
      `Error searching product browser: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default searchProductBrowser;
```

**What changed (vs. main):**
- `baseQuery` now accepts `sourceSystem?` and conditionally adds the `source_system = ...` WHERE.
- All four search helpers (`queryIngredients` / `queryFamily` / `queryProductName` / `queryTradeName`) accept optional `sourceSystem`, select `pb.source_system`, swap the WHERE / ANDWHERE depending on whether the system filter is present, and adapt `DISTINCT ON` (single column when scoped, `name + source_system` when fanning out — so the same ingredient name across UAN + AEMS doesn't collapse to one row).
- Each returned item carries its own `sourceSystem` field on every shape (search + hierarchy).
- Request body destructure now types `sourceSystem` as `string | undefined`.

### 1.3 Routes (unchanged on branch — for reference)

**File:** `src/modules/product-browser/product-browser.routes.ts`

```typescript
/**
 * Product Browser routes — mounted at /api/v1/product-browser.
 *
 *   POST  /search  → search the catalog at a chosen hierarchy level
 *                    (INGREDIENT | PRODUCT_FAMILY | PRODUCT_NAME |
 *                    TRADE_NAME | ALL), filtered by `sourceSystem` and
 *                    matched ILIKE on the supplied `searchedValue`.
 *
 * POST (not GET) mirrors the UAN `getProductData` contract — the FE
 * sends the criteria in a JSON body. Gated on `productGroup` READ —
 * the same permission that protects the product-group screens.
 */
import { Router } from 'express';
import { ACCESS } from '../../shared/constants/permissions/access';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import VerifyResourceMiddleware from '../../shared/middleware/verifyResource.middleware';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import ProductBrowserController from './controllers/product-browser.controller';
import SearchProductBrowserValidation from './middleware/listProductBrowser.validation';

const router = Router();
const controller = new ProductBrowserController();

router.post(
  '/search',
  AuthMiddleware,
  VerifyPermissionMiddleware('productGroup', ACCESS.READ),
  VerifyResourceMiddleware,
  SearchProductBrowserValidation,
  controller.search,
);

export default router;
```

---

## 2. Product Groups

`/api/v1/product-groups` — full CRUD over saved hierarchy groupings. Each group has a `code` (unique per scope + client when not soft-deleted), a `name`, an optional `description`, an `is_enabled` status flag, and a collection of members. A member is either a hierarchy pick (`member_type='product'`) or a reference to another group (`member_type='group'`).

### 2.1 Schema

```
product_group
  product_group_id           int4 PK (identity)
  code                       text NOT NULL
  name                       text NOT NULL
  description                text NULL          -- ≤ 500 chars (Joi-enforced)
  scope_id                   int2 NOT NULL → scope.scope_id
  client_id                  text NULL          -- 4-char clientCode owner
  enterprise_id              bigint NULL        -- optional sub-tenant
  is_enabled                 bool DEFAULT true
  created_by                 text NULL          -- uuid user id
  created_at                 timestamptz DEFAULT now()
  updated_by                 text NULL
  updated_at                 timestamptz NULL
  deleted_on                 timestamptz NULL   -- TypeORM @DeleteDateColumn
  deleted_by                 text NULL

UNIQUE (COALESCE(client_id, 0), scope_id, code) WHERE deleted_on IS NULL
INDEX  ix_pg_scope (scope_id)

product_group_member
  product_group_member_id    int4 PK (identity)
  product_group_id           int4 NOT NULL → product_group.product_group_id ON DELETE CASCADE
  member_type                text ('product' | 'group')
  source_system              text NULL          -- product members only
  level                      text NULL          -- product members only
  code                       text NULL          -- catalog code (products) or child group code (group)
  parent_product_group_id    int4 NULL → product_group.product_group_id  -- group members only
  name                       text NULL
  tgt_insert_date_time       timestamptz DEFAULT now()
  deleted_on                 timestamptz NULL
  deleted_by                 text NULL

CHECK (
  (member_type='product' AND level IS NOT NULL AND source_system IS NOT NULL AND name IS NOT NULL AND parent_product_group_id IS NULL)
  OR
  (member_type='group'   AND code IS NOT NULL AND parent_product_group_id IS NOT NULL AND level IS NULL AND source_system IS NULL)
)
INDEX  ix_pgm_group (product_group_id)
```

**Schema deltas vs. the original DDL the user provided:**

- `description` (text NULL) added so the FE Description field is a real BE column instead of a code-aliased fallback.
- `is_enabled` (bool default true) added to surface an Active/Inactive flag without abusing soft-delete.
- `deleted` bool replaced with `deleted_on` timestamptz + `deleted_by` text — same soft-delete pattern as `Role` / `User`. Every soft-delete check is `deleted_on IS NULL`.
- `client_id` declared as `text` (instead of int8) — stores the 4-char tenant `clientCode` directly.
- `created_by` / `updated_by` / `deleted_by` are `text` (uuid user id) instead of int8.

### 2.2 Entity — ProductGroup (full source)

**File:** `src/shared/db/entities/product-group.entity.ts`

```typescript
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Scope } from './scope.entity';
import { ProductGroupMember } from './product-group-member.entity';

/**
 * Saved grouping of MedDRA/product hierarchy picks. A product group
 * carries a `code` (unique per scope + client when not soft-deleted)
 * and a name; the picks live in `product_group_member`. Used by
 * signal-detection runs and dashboards to scope analytics to a
 * curated product set.
 *
 * Soft-delete via TypeORM's `@DeleteDateColumn` (`deleted_on`) +
 * an audit `deleted_by` — same pattern as `Role` / `User`. List
 * endpoints filter out soft-deleted rows; the partial unique index
 * lets a deleted code be reused by a new row.
 *
 * The partial unique index `(COALESCE(client_id, 0), scope_id, code)
 * WHERE deleted_on IS NULL` from the DDL isn't expressible via TypeORM
 * decorators — recreate after sync via:
 *
 *   CREATE UNIQUE INDEX ux_pg_code ON product_group
 *     (COALESCE(client_id, 0::bigint), scope_id, code)
 *     WHERE deleted_on IS NULL;
 */
@Entity('product_group')
@Index('ix_pg_scope', ['scopeId'])
export class ProductGroup extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'integer', name: 'product_group_id' })
  productGroupId: number;

  @Column({ type: 'text' })
  code: string;

  @Column({ type: 'text' })
  name: string;

  /** Free-form description, ≤ 500 chars (enforced at the validator). */
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'smallint', name: 'scope_id' })
  scopeId: number;

  @ManyToOne(() => Scope)
  @JoinColumn({ name: 'scope_id' })
  scope?: Scope;

  /** Multi-tenant owner — stamped with `clientData.clientCode` at
   *  create time. Null = system-scope (visible across clients). */
  @Column({ type: 'text', name: 'client_id', nullable: true })
  clientId?: string | null;

  /** Optional sub-tenant key — some clients carve into enterprises. */
  @Column({ type: 'bigint', name: 'enterprise_id', nullable: true })
  enterpriseId?: string | null;

  /** 1 = Active, 0 = Inactive. Edited via Edit page; defaults to
   *  Active on create. */
  @Column({ type: 'boolean', name: 'is_enabled', default: true })
  isEnabled: boolean;

  /* Audit columns store the caller's user id, which is a UUID across
   * this codebase (User.id is uuid). Using `text` keeps the column
   * type-flexible and matches the convention in `Role` / `User`. */
  @Column({ type: 'text', name: 'created_by', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'text', name: 'updated_by', nullable: true })
  updatedBy?: string | null;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at', nullable: true })
  updatedAt?: Date | null;

  /** Soft-delete: set automatically by TypeORM's `softRemove`. List
   *  endpoints add `WHERE deleted_on IS NULL` to hide these rows. */
  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_on', nullable: true })
  deletedOn?: Date | null;

  @Column({ type: 'text', name: 'deleted_by', nullable: true })
  deletedBy?: string | null;

  @OneToMany(() => ProductGroupMember, m => m.productGroup)
  members?: ProductGroupMember[];
}
```

### 2.3 Entity — ProductGroupMember (full source)

**File:** `src/shared/db/entities/product-group-member.entity.ts`

```typescript
import {
  BaseEntity,
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductGroup } from './product-group.entity';

/**
 * A member of a product group. Two shapes share this table:
 *
 *   - `member_type='product'` — a hierarchy pick from the product
 *     catalog. Carries `source_system`, `level`, `name`, and (when
 *     the catalog ships one) `code`. `parent_product_group_id` is null.
 *
 *   - `member_type='group'` — a nested product group reference.
 *     Carries `code` (the child group's code) and
 *     `parent_product_group_id` (FK to product_group).
 *     `source_system`, `level` are null.
 *
 * The CHECK constraint enforces the shape disjunction; the partial
 * index on `parent_product_group_id` keeps nested-group lookups fast
 * when most rows are products.
 *
 * Soft-delete via `@DeleteDateColumn` mirrors the parent entity.
 */
@Entity('product_group_member')
@Index('ix_pgm_group', ['productGroupId'])
@Check(
  `(
    (member_type = 'product'
       AND level IS NOT NULL
       AND source_system IS NOT NULL
       AND name IS NOT NULL
       AND parent_product_group_id IS NULL)
    OR
    (member_type = 'group'
       AND code IS NOT NULL
       AND parent_product_group_id IS NOT NULL
       AND level IS NULL
       AND source_system IS NULL)
  )`,
)
@Check(`member_type IN ('product', 'group')`)
export class ProductGroupMember extends BaseEntity {
  @PrimaryGeneratedColumn({
    type: 'integer',
    name: 'product_group_member_id',
  })
  productGroupMemberId: number;

  @Column({ type: 'integer', name: 'product_group_id' })
  productGroupId: number;

  @ManyToOne(() => ProductGroup, g => g.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_group_id' })
  productGroup?: ProductGroup;

  @Column({ type: 'text', name: 'member_type' })
  memberType: 'product' | 'group';

  @Column({ type: 'text', name: 'source_system', nullable: true })
  sourceSystem?: string | null;

  @Column({ type: 'text', nullable: true })
  level?: string | null;

  @Column({ type: 'text', nullable: true })
  code?: string | null;

  @Column({ type: 'integer', name: 'parent_product_group_id', nullable: true })
  parentProductGroupId?: number | null;

  @ManyToOne(() => ProductGroup)
  @JoinColumn({ name: 'parent_product_group_id' })
  parentProductGroup?: ProductGroup;

  @Column({ type: 'text', nullable: true })
  name?: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'tgt_insert_date_time' })
  tgtInsertDateTime: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_on', nullable: true })
  deletedOn?: Date | null;

  /* UUID user id — same shape as the parent entity. */
  @Column({ type: 'text', name: 'deleted_by', nullable: true })
  deletedBy?: string | null;
}
```

### 2.4 Entity registration

**File:** `src/shared/db/entities/all_entities.constant.ts` — both entities appended.

```typescript
import { AccessLevel } from './access-level.entity';
import { Client } from './client.entity';
import { ClientConfig } from './clientConfig.entity';
import { DataSource } from './data-source.entity';
import { DataSourceType } from './data-source-type.entity';
import { Group } from './group.entity';
import { PasswordHistory } from './passwordHistory.entity';
import { Permission } from './permission.entity';
import { ProductBrowser } from './product-browser.entity';
import { ProductGroup } from './product-group.entity';
import { ProductGroupMember } from './product-group-member.entity';
import { Role } from './role.entity';
import { RolePermissionMapping } from './role-permission-mapping.entity';
import { Scope } from './scope.entity';
import { StatisticalConstantsProfile } from './statistical-constants-profile.entity';
import { ThresholdCondition } from './threshold-condition.entity';
import { ThresholdProfile } from './threshold-profile.entity';
import { User } from './user.entity';
import { UserGroupMapping } from './user-group-mapping.entity';

export const ALL_ENTITIES = [
  AccessLevel,
  Client,
  ClientConfig,
  DataSource,
  DataSourceType,
  Group,
  PasswordHistory,
  Permission,
  ProductBrowser,
  ProductGroup,
  ProductGroupMember,
  Role,
  RolePermissionMapping,
  Scope,
  StatisticalConstantsProfile,
  ThresholdCondition,
  ThresholdProfile,
  User,
  UserGroupMapping,
];
```

### 2.5 Seed (full source)

**File:** `src/shared/helpers/system/seedProductGroups.ts`

Seeds the two fixture groups (`ONCOLOGY_PORTFOLIO`, `BIOSIMILARS`) + 5 member rows. Idempotent — upserts by id, refreshes columns on every boot, restores `deleted_on = null` if the row had been soft-deleted.

```typescript
/**
 * seedProductGroups — populates the `product_group` + `product_group_member`
 * fixtures lifted from product_group_*.csv. Idempotent: upserts by id so
 * the assigned PKs stay stable across boots and downstream FKs don't
 * drift.
 *
 * Runs AFTER `seedScopes` because every fixture row references a scope
 * by code (we resolve the FK target at runtime instead of trusting the
 * id baked into the CSV, since `scope_id` is auto-assigned).
 *
 * The CSVs use `scope_id=2` which corresponds to the `org` scope on
 * the legacy box. We map by code here so the fixture survives a fresh
 * sync where `org` gets a different `scope_id`.
 */
import { EntityManager } from 'typeorm';
import { ProductGroup } from '../../db/entities/product-group.entity';
import { ProductGroupMember } from '../../db/entities/product-group-member.entity';
import { Scope } from '../../db/entities/scope.entity';
import Logger from '../../utility/logger/logger';

interface ProductGroupSeed {
  productGroupId: number;
  code: string;
  name: string;
  scopeCode: string;
  clientId: string | null;
  enterpriseId: string | null;
}

interface ProductGroupMemberSeed {
  productGroupMemberId: number;
  productGroupId: number;
  memberType: 'product' | 'group';
  sourceSystem: string | null;
  level: string | null;
  code: string | null;
  parentProductGroupId: number | null;
  name: string | null;
}

const GROUPS: ProductGroupSeed[] = [
  {
    productGroupId: 1,
    code: 'ONCOLOGY_PORTFOLIO',
    name: 'Oncology portfolio',
    scopeCode: 'org',
    clientId: '9999',
    enterpriseId: '13',
  },
  {
    productGroupId: 2,
    code: 'BIOSIMILARS',
    name: 'Biosimilars',
    scopeCode: 'org',
    clientId: '9999',
    enterpriseId: '13',
  },
];

const MEMBERS: ProductGroupMemberSeed[] = [
  {
    productGroupMemberId: 1,
    productGroupId: 2,
    memberType: 'product',
    sourceSystem: 'AEMS',
    level: 'ingredient',
    code: '327361',
    parentProductGroupId: null,
    name: 'adalimumab',
  },
  {
    productGroupMemberId: 2,
    productGroupId: 2,
    memberType: 'product',
    sourceSystem: 'AEMS',
    level: 'ingredient',
    code: null,
    parentProductGroupId: null,
    name: 'adalimumab-aacf',
  },
  {
    productGroupMemberId: 3,
    productGroupId: 2,
    memberType: 'product',
    sourceSystem: 'AEMS',
    level: 'ingredient',
    code: null,
    parentProductGroupId: null,
    name: 'adalimumab-adbm',
  },
  {
    productGroupMemberId: 4,
    productGroupId: 1,
    memberType: 'product',
    sourceSystem: 'UAN',
    level: 'ingredient',
    code: '112993',
    parentProductGroupId: null,
    name: 'Abacavir hydrochloride',
  },
  {
    productGroupMemberId: 5,
    productGroupId: 1,
    memberType: 'group',
    sourceSystem: null,
    level: null,
    code: 'BIOSIMILARS',
    parentProductGroupId: 2,
    name: 'Biosimilars',
  },
];

const seedProductGroups = async (manager: EntityManager): Promise<void> => {
  const scopeRepo = manager.getRepository(Scope);
  const groupRepo = manager.getRepository(ProductGroup);
  const memberRepo = manager.getRepository(ProductGroupMember);

  /* Resolve scope FK by code so the seed survives a re-numbered
   * scope_id. Bail loudly if the prerequisite seeder hasn't run. */
  const scopes = await scopeRepo.find();
  const scopeIdByCode = new Map(scopes.map(s => [s.code, s.scopeId]));

  for (const g of GROUPS) {
    const scopeId = scopeIdByCode.get(g.scopeCode);
    if (scopeId === undefined) {
      throw new Error(
        `[seedProductGroups] scope code "${g.scopeCode}" not found. ` +
          `Did seedScopes run first?`,
      );
    }

    const existing = await groupRepo.findOne({
      where: { productGroupId: g.productGroupId },
    });
    if (existing) {
      existing.code = g.code;
      existing.name = g.name;
      existing.scopeId = scopeId;
      existing.clientId = g.clientId;
      existing.enterpriseId = g.enterpriseId;
      existing.deletedOn = null;
      await groupRepo.save(existing);
      continue;
    }
    const created = groupRepo.create({
      productGroupId: g.productGroupId,
      code: g.code,
      name: g.name,
      scopeId,
      clientId: g.clientId,
      enterpriseId: g.enterpriseId,
      isEnabled: true,
    });
    await groupRepo.save(created);
  }

  for (const m of MEMBERS) {
    const existing = await memberRepo.findOne({
      where: { productGroupMemberId: m.productGroupMemberId },
    });
    if (existing) {
      existing.productGroupId = m.productGroupId;
      existing.memberType = m.memberType;
      existing.sourceSystem = m.sourceSystem;
      existing.level = m.level;
      existing.code = m.code;
      existing.parentProductGroupId = m.parentProductGroupId;
      existing.name = m.name;
      existing.deletedOn = null;
      await memberRepo.save(existing);
      continue;
    }
    const created = memberRepo.create({
      productGroupMemberId: m.productGroupMemberId,
      productGroupId: m.productGroupId,
      memberType: m.memberType,
      sourceSystem: m.sourceSystem,
      level: m.level,
      code: m.code,
      parentProductGroupId: m.parentProductGroupId,
      name: m.name,
    });
    await memberRepo.save(created);
  }

  Logger.info('Product group fixtures seeded / refreshed.');
};

export default seedProductGroups;
```

### 2.6 Seed hook — `shared/db/index.ts`

The seed transaction grew one line. New import:

```typescript
import seedProductGroups from '../helpers/system/seedProductGroups';
```

…and one call at the end of the existing reference-data block:

```typescript
await connection.manager.transaction(async manager => {
  await seedAccessLevels(manager);
  await seedPermissionCatalog(manager);
  await seedDataSourceTypes(manager);
  // Pharmacovigilance reference data. Scope must seed first because
  // threshold + stats-constants profiles reference scope by code.
  await seedScopes(manager);
  await seedThresholdProfiles(manager);
  await seedStatisticalConstantsProfiles(manager);
  await seedProductGroups(manager);
});
```

Nothing else in `Database.connect()` changed.

### 2.7 Validator — List (full source)

**File:** `src/modules/product-groups/middleware/listProductGroup.validation.ts`

```typescript
/**
 * ListProductGroupValidation — validates pagination + sort query
 * params for `GET /api/v1/product-groups`. Same shape as the
 * threshold-profile / data-source list validators: numeric paging,
 * `<field>:asc|desc` sort with a server-side whitelist, opaque
 * JSON-encoded `filter` blob parsed in the controller.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE, MAX_ROW } from '../../../../config/config';
import { GENERIC } from '../../../shared/constants/response.messages';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

export type ProductGroupListSortField =
  | 'name'
  | 'code'
  | 'scopeId'
  | 'createdAt';

const ALLOWED_SORT_FIELDS: ProductGroupListSortField[] = [
  'name',
  'code',
  'scopeId',
  'createdAt',
];

const schema = Joi.object({
  limit: Joi.number().integer().min(1).max(MAX_ROW).optional(),
  page: Joi.number().integer().min(1).optional(),
  filter: Joi.string().optional(),
  /* `includeMembers` flips the BE between the lean list payload (one
   * row per group, member counts only) and the expanded shape (every
   * group's members inlined). Default is lean — the consuming list
   * screen doesn't need member rows until the user clicks a group. */
  includeMembers: Joi.boolean().optional(),
  sort: Joi.string()
    .pattern(/^(\w+):(asc|desc)$/i)
    .optional()
    .messages({
      'string.pattern.base':
        'sort must be in the form `<field>:asc` or `<field>:desc`',
    }),
}).custom((value, helpers) => {
  if (value.sort) {
    const [field] = value.sort.split(':');
    if (!ALLOWED_SORT_FIELDS.includes(field as ProductGroupListSortField)) {
      return helpers.error('any.invalid', {
        message: `sort field must be one of: ${ALLOWED_SORT_FIELDS.join(', ')}`,
      });
    }
  }
  return value;
});

const ListProductGroupValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { error, value } = validateSchema(schema, req.query);
    if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);
    req.query = value;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default ListProductGroupValidation;
```

### 2.8 Controller — List (full source)

**File:** `src/modules/product-groups/controllers/listProductGroup.ts`

```typescript
/**
 * listProductGroup — paginated, filterable, sortable list of product
 * groups with their parent scope joined inline. Mirrors the
 * threshold-profile list controller's shape so the FE can reuse the
 * same paginator / sort / filter ergonomics.
 *
 * Member rows are NOT joined by default — the list screen only needs
 * counts per group. When `?includeMembers=true` the controller fans
 * out a second batch query keyed by IN (...productGroupId), grouping
 * members in JS so pagination stays correct.
 *
 * Soft-deleted rows are filtered out at the SQL layer (`deleted =
 * false`) — they never appear in user-facing lists.
 *
 * Filter keys (all optional, only present keys filter):
 *   - name              → ILIKE %term% on name
 *   - code              → ILIKE %term% on code
 *   - description       → ILIKE %term% on description
 *   - scopeId           → exact match (numeric)
 *   - status            → 0|1 maps to is_enabled boolean
 *   - createdDateFrom   → pg.created_at >= :from
 *   - createdDateTo     → pg.created_at <= :to
 *
 * Soft-deleted rows (`deleted_on IS NOT NULL`) are hidden at the SQL
 * layer — they never appear in user-facing lists.
 *
 * `canEdit` / `canDelete` are computed per row:
 *   - `scope.code === 'system'`        → both false (platform-owned, read-only)
 *   - `clientId !== caller.clientCode` → both false (cross-tenant)
 *   - otherwise                        → both true
 *
 * Malformed JSON in `filter` is logged + ignored. Mirrors threshold-
 * profile convention so a bad FE state doesn't break the page.
 */
import { In } from 'typeorm';
import { Request, Response } from 'express';
import { CODE, DEFAULT_PAGE, MAX_ROW } from '../../../../config/config';
import {
  GENERIC,
  PRODUCT_GROUP as PG_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ProductGroup } from '../../../shared/db/entities/product-group.entity';
import { ProductGroupMember } from '../../../shared/db/entities/product-group-member.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { applySort } from '../../../shared/utility/listSort';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { ProductGroupListSortField } from '../middleware/listProductGroup.validation';

/* JS property names per TypeORM mapping — the QB rewrites them to
 * column names at SQL-gen time. */
const SORT_COLUMN_MAP: Record<ProductGroupListSortField, string> = {
  name: 'pg.name',
  code: 'pg.code',
  scopeId: 'pg.scopeId',
  createdAt: 'pg.createdAt',
};

const listProductGroup = async (req: Request, res: Response) => {
  Logger.info('List Product Groups request');

  const {
    limit = MAX_ROW,
    page = DEFAULT_PAGE,
    filter,
    sort,
    includeMembers,
  } = req.query as {
    limit?: number;
    page?: number;
    filter?: string;
    sort?: string;
    includeMembers?: boolean;
  };

  /* clientData is stamped onto res.locals by AuthMiddleware. The 4-
   * char clientCode is what we wrote into `client_id` on create, so
   * the same value gates canEdit / canDelete here. */
  const callerClientCode: string | null =
    res.locals.clientData?.clientCode ?? null;

  try {
    const query = AppDataSource.getRepository(ProductGroup)
      .createQueryBuilder('pg')
      .leftJoinAndSelect('pg.scope', 'scope')
      .where('pg.deleted_on IS NULL');

    if (filter) {
      try {
        const parsed = JSON.parse(filter);
        if (parsed.name) {
          query.andWhere('pg.name ILIKE :name', {
            name: `%${parsed.name}%`,
          });
        }
        if (parsed.code) {
          query.andWhere('pg.code ILIKE :code', {
            code: `%${parsed.code}%`,
          });
        }
        if (parsed.description) {
          query.andWhere('pg.description ILIKE :description', {
            description: `%${parsed.description}%`,
          });
        }
        if (
          parsed.scopeId !== undefined &&
          parsed.scopeId !== null &&
          parsed.scopeId !== ''
        ) {
          query.andWhere('pg.scope_id = :scopeId', {
            scopeId: Number(parsed.scopeId),
          });
        }
        if (
          parsed.status !== undefined &&
          parsed.status !== null &&
          parsed.status !== ''
        ) {
          query.andWhere('pg.is_enabled = :isEnabled', {
            isEnabled: Number(parsed.status) === 1,
          });
        }
        if (parsed.createdDateFrom) {
          query.andWhere('pg.created_at >= :createdFrom', {
            createdFrom: parsed.createdDateFrom,
          });
        }
        if (parsed.createdDateTo) {
          query.andWhere('pg.created_at <= :createdTo', {
            createdTo: parsed.createdDateTo,
          });
        }
      } catch (e) {
        Logger.error(`Error parsing filter: ${getErrorMessage(e)}`);
      }
    }

    applySort(query, sort, SORT_COLUMN_MAP, 'pg.createdAt', 'DESC');

    const [rows, count] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    /* Batch-load member counts (or full members when requested) in a
     * single round trip keyed by IN(...). Cheaper than letting TypeORM
     * eager-join — that would multiply parent rows and break the
     * paginator's `count`. */
    const groupIds = rows.map(r => r.productGroupId);
    const membersByGroup = new Map<number, ProductGroupMember[]>();
    const countsByGroup = new Map<number, number>();

    if (groupIds.length > 0) {
      if (includeMembers) {
        const ms = await AppDataSource.getRepository(ProductGroupMember).find({
          where: { productGroupId: In(groupIds) },
          order: { productGroupMemberId: 'ASC' },
        });
        for (const m of ms) {
          if (!membersByGroup.has(m.productGroupId)) {
            membersByGroup.set(m.productGroupId, []);
          }
          membersByGroup.get(m.productGroupId)!.push(m);
          countsByGroup.set(
            m.productGroupId,
            (countsByGroup.get(m.productGroupId) ?? 0) + 1,
          );
        }
      } else {
        const counts = await AppDataSource.getRepository(ProductGroupMember)
          .createQueryBuilder('m')
          .select('m.product_group_id', 'productGroupId')
          .addSelect('COUNT(*)', 'count')
          .where('m.product_group_id IN (:...ids)', { ids: groupIds })
          .andWhere('m.deleted_on IS NULL')
          .groupBy('m.product_group_id')
          .getRawMany<{ productGroupId: number; count: string }>();
        for (const c of counts) {
          countsByGroup.set(Number(c.productGroupId), Number(c.count));
        }
      }
    }

    const productGroups = rows.map(pg => {
      /* Two-rule mutability check, mirrors threshold profiles:
       *   - system-scope rows are platform-defined and read-only
       *   - cross-tenant rows belong to another client; the caller
       *     can list them (per scope rules) but can't mutate them */
      const isSystem = pg.scope?.code === 'system';
      const ownsRow =
        !!callerClientCode && pg.clientId === callerClientCode;
      const isMutable = !isSystem && ownsRow;
      return {
        ...pg,
        memberCount: countsByGroup.get(pg.productGroupId) ?? 0,
        ...(includeMembers
          ? { members: membersByGroup.get(pg.productGroupId) ?? [] }
          : {}),
        canEdit: isMutable,
        canDelete: isMutable,
      };
    });

    sendResponse(res, true, CODE.SUCCESS, PG_MSG.LIST_FETCHED, {
      count,
      productGroups,
    });
  } catch (error) {
    Logger.error(
      `Error while listing product groups: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default listProductGroup;
```

### 2.9 Validator — Add (full source)

**File:** `src/modules/product-groups/middleware/addProductGroup.validation.ts`

```typescript
/**
 * AddProductGroupValidation — validates `POST /api/v1/product-groups`.
 *
 * Body shape:
 *   - `code` (required, uppercase + slug pattern)
 *   - `name` (required, 2–128 chars)
 *   - `description` (optional, ≤ 500 chars)
 *   - `isEnabled` (optional, default true)
 *   - `members` (required, ≥ 1 row) — each:
 *       memberType:    'product' (only product members are accepted
 *                       on create; nested group refs land via a
 *                       separate flow)
 *       sourceSystem:  required (e.g. 'UAN', 'AEMS')
 *       level:         required (lowercase: 'ingredient' / 'family' /
 *                       'product_name' / 'trade_name')
 *       name:          required
 *       code:          optional (some catalog rows ship without one)
 *
 * `scopeId` is NOT accepted on the wire — every tenant-created group
 * is forced to the `org` scope (mirrors the threshold-profile copy
 * flow). The controller resolves the scope by stable code at insert
 * time so the id stays correct even if the seed re-numbers.
 *
 * Uniqueness check `(client_id, scope_id, code) WHERE deleted_on IS
 * NULL` runs here against the resolved `org` scope and bails with
 * ALREADY_EXISTS if the tenant already has a group with this code
 * under the org scope. `client_id` comes from `clientData.clientCode`
 * on res.locals — never trust client-supplied `clientId` on the wire.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { IsNull } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  PRODUCT_GROUP as PG_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ProductGroup } from '../../../shared/db/entities/product-group.entity';
import { Scope } from '../../../shared/db/entities/scope.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,63}$/;
const ALLOWED_LEVELS = [
  'ingredient',
  'product_family',
  'product_name',
  'trade_name',
] as const;

const memberSchema = Joi.object({
  memberType: Joi.string().valid('product').required().messages({
    'any.only': 'Only product members are accepted on create',
    'any.required': 'memberType is required',
  }),
  sourceSystem: Joi.string().trim().min(1).max(64).required().messages({
    'string.empty': 'sourceSystem is required',
    'any.required': 'sourceSystem is required',
  }),
  level: Joi.string()
    .trim()
    .lowercase()
    .valid(...ALLOWED_LEVELS)
    .required()
    .messages({
      'any.only': `level must be one of: ${ALLOWED_LEVELS.join(', ')}`,
      'any.required': 'level is required',
    }),
  name: Joi.string().trim().min(1).max(255).required().messages({
    'string.empty': 'name is required',
    'any.required': 'name is required',
  }),
  /* Some catalog rows arrive without a stable id — accept null/empty
   * and persist whatever the FE has. */
  code: Joi.string().trim().max(64).optional().allow('', null),
});

const schema = Joi.object({
  code: Joi.string()
    .trim()
    .uppercase()
    .min(2)
    .max(64)
    .pattern(CODE_PATTERN)
    .required()
    .messages({
      'string.empty': 'Code is required',
      'any.required': 'Code is required',
      'string.min': 'Code must be at least 2 characters',
      'string.max': 'Code must not exceed 64 characters',
      'string.pattern.base':
        'Code must start with a letter/digit and contain only letters, digits, underscores, and hyphens',
    }),
  name: Joi.string().trim().min(2).max(128).required().messages({
    'string.empty': 'Name is required',
    'any.required': 'Name is required',
    'string.min': 'Name must be at least 2 characters',
    'string.max': 'Name must not exceed 128 characters',
  }),
  description: Joi.string().trim().max(500).optional().allow('', null),
  isEnabled: Joi.boolean().optional(),
  members: Joi.array().items(memberSchema).min(1).required().messages({
    'array.min': 'At least one member is required',
    'any.required': 'members is required',
  }),
});

const AddProductGroupValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { error, value } = validateSchema(schema, req.body);
    if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);
    req.body = value;

    /* Resolve the `org` scope by stable code. Tenant-created groups
     * are always org-scoped; the FE doesn't pick a scope. Stamped onto
     * res.locals so the controller doesn't re-query. */
    const orgScope = await AppDataSource.getRepository(Scope).findOne({
      where: { code: 'org' },
    });
    if (!orgScope) {
      Logger.error('Scope with code "org" not found. Did seedScopes run?');
      return sendResponse(res, false, CODE.SERVER_ERROR, PG_MSG.SCOPE_INVALID);
    }
    res.locals.orgScopeId = orgScope.scopeId;

    /* Uniqueness check scoped to the caller's tenant under the org
     * scope. Matches the partial unique index `(COALESCE(client_id,
     * 0), scope_id, code) WHERE deleted_on IS NULL`. */
    const clientCode: string | null =
      res.locals.clientData?.clientCode ?? null;
    const dup = await AppDataSource.getRepository(ProductGroup).findOne({
      where: {
        /* `clientId IS NULL` and `clientId = '...'` need different
         * where shapes in TypeORM. Branch so the uniqueness check
         * mirrors the SQL partial index `(COALESCE(client_id, 0),
         * scope_id, code)`. */
        clientId: clientCode === null ? IsNull() : clientCode,
        scopeId: orgScope.scopeId,
        code: value.code,
        deletedOn: IsNull(),
      },
    });
    if (dup) {
      return sendResponse(
        res,
        false,
        CODE.ALREADY_EXISTS,
        PG_MSG.ALREADY_EXISTS,
      );
    }

    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default AddProductGroupValidation;
```

### 2.10 Controller — Add (full source)

**File:** `src/modules/product-groups/controllers/addProductGroup.ts`

```typescript
/**
 * addProductGroup — POST /api/v1/product-groups.
 *
 * Validator (addProductGroup.validation.ts) has already verified the
 * body shape, the scope existence, and the (client, scope, code)
 * uniqueness invariant. This controller is pure write logic, wrapped
 * in a transaction so an inserted parent rolls back if any member
 * insert fails — no orphan groups.
 *
 * Stamps the row with the caller's tenant code (`clientData.clientCode`)
 * and the caller's user id; the FE never sends `clientId`.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  PRODUCT_GROUP as PG_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ProductGroup } from '../../../shared/db/entities/product-group.entity';
import { ProductGroupMember } from '../../../shared/db/entities/product-group-member.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

interface AddBody {
  code: string;
  name: string;
  description?: string | null;
  isEnabled?: boolean;
  members: Array<{
    memberType: 'product';
    sourceSystem: string;
    level: string;
    name: string;
    code?: string | null;
  }>;
}

const addProductGroup = async (req: Request, res: Response) => {
  Logger.info('Add Product Group request');

  const { code, name, description, isEnabled, members } = req.body as AddBody;
  const { clientData, loggedInId, orgScopeId } = res.locals;
  const clientCode: string | null = clientData?.clientCode ?? null;

  try {
    const saved = await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        const groupRepo = manager.getRepository(ProductGroup);
        const memberRepo = manager.getRepository(ProductGroupMember);

        const group = groupRepo.create({
          code,
          name,
          /* Forced to `org` by the validator — every tenant-created
           * group is org-scoped. Matches threshold-profile copy. */
          scopeId: orgScopeId,
          description: description ?? null,
          isEnabled: isEnabled ?? true,
          clientId: clientCode,
          createdBy: loggedInId ?? null,
        });
        const savedGroup = await groupRepo.save(group);

        const memberRows = members.map(m =>
          memberRepo.create({
            productGroupId: savedGroup.productGroupId,
            memberType: 'product',
            sourceSystem: m.sourceSystem,
            level: m.level,
            name: m.name,
            /* Empty / null code is fine — the CHECK constraint allows
             * it for product members (only `name`, `level`,
             * `source_system` are required). */
            code: m.code?.trim() || null,
          }),
        );
        const savedMembers = await memberRepo.save(memberRows);

        return { group: savedGroup, members: savedMembers };
      },
    );

    sendResponse(res, true, CODE.SUCCESS, PG_MSG.CREATED, {
      ...saved.group,
      members: saved.members,
    });
  } catch (error) {
    Logger.error(`Error adding product group: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default addProductGroup;
```

### 2.11 Validator — Get (full source)

**File:** `src/modules/product-groups/middleware/getProductGroup.validation.ts`

```typescript
/**
 * GetProductGroupValidation — resolves the product group + its
 * (non-deleted) members and the scope relation, so the controller is
 * pure response shaping. Anything that's soft-deleted (`deletedOn IS
 * NOT NULL`) is treated as missing — 404.
 *
 * `:id` must parse as a positive integer.
 */
import { NextFunction, Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  PRODUCT_GROUP as PG_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ProductGroup } from '../../../shared/db/entities/product-group.entity';
import { ProductGroupMember } from '../../../shared/db/entities/product-group-member.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const GetProductGroupValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return sendResponse(res, false, CODE.BAD_REQUEST, PG_MSG.NOT_FOUND);
    }

    const group = await AppDataSource.getRepository(ProductGroup)
      .createQueryBuilder('pg')
      .leftJoinAndSelect('pg.scope', 'scope')
      .where('pg.product_group_id = :id', { id })
      .andWhere('pg.deleted_on IS NULL')
      .getOne();

    if (!group) {
      return sendResponse(res, false, CODE.NOT_FOUND, PG_MSG.NOT_FOUND);
    }

    /* Members fetched separately so pagination on list never trips
     * over the same join — keeps the two query shapes symmetric. */
    const members = await AppDataSource.getRepository(ProductGroupMember).find({
      where: { productGroupId: id },
      order: { productGroupMemberId: 'ASC' },
    });

    res.locals.productGroup = group;
    res.locals.productGroupMembers = members;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default GetProductGroupValidation;
```

### 2.12 Controller — Get (full source)

**File:** `src/modules/product-groups/controllers/getProductGroup.ts`

```typescript
/**
 * getProductGroup — GET /api/v1/product-groups/:id. The validator
 * pre-loaded the group + scope + members onto res.locals, so this
 * controller is pure response shaping.
 *
 * Returns the full group row with `members: ProductGroupMember[]`
 * inlined plus per-row `canEdit` / `canDelete` flags. Same mutability
 * rule as the list controller:
 *   - `scope.code === 'system'`           → false
 *   - `clientId !== caller.clientCode`    → false
 *   - otherwise                           → true
 *
 * Permission: `productGroup` READ.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import { PRODUCT_GROUP as PG_MSG } from '../../../shared/constants/response.messages';
import { ProductGroup } from '../../../shared/db/entities/product-group.entity';
import { ProductGroupMember } from '../../../shared/db/entities/product-group-member.entity';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const getProductGroup = async (_req: Request, res: Response) => {
  Logger.info('Get Product Group request');

  const group = res.locals.productGroup as ProductGroup;
  const members = res.locals.productGroupMembers as ProductGroupMember[];
  const callerClientCode: string | null =
    res.locals.clientData?.clientCode ?? null;

  const isSystem = group.scope?.code === 'system';
  const ownsRow = !!callerClientCode && group.clientId === callerClientCode;
  const isMutable = !isSystem && ownsRow;

  sendResponse(res, true, CODE.SUCCESS, PG_MSG.FETCHED, {
    ...group,
    members,
    canEdit: isMutable,
    canDelete: isMutable,
  });
};

export default getProductGroup;
```

### 2.13 Validator — Update (full source)

**File:** `src/modules/product-groups/middleware/updateProductGroup.validation.ts`

```typescript
/**
 * UpdateProductGroupValidation — `PUT /api/v1/product-groups/:id`.
 *
 * Body shape (all but `members` optional):
 *   - `name`        — 2–128 chars
 *   - `description` — ≤ 500 chars (allow '' / null to clear)
 *   - `isEnabled`   — boolean
 *   - `members`     — REQUIRED on every update. Wholesale replace; the
 *                     prior member rows are soft-deleted and the new
 *                     set is inserted in the same transaction. At
 *                     least one row required. Per-row shape matches
 *                     the Add validator (memberType='product',
 *                     sourceSystem, level, name; code optional).
 *
 * `code` is intentionally NOT accepted on update — it's the stable
 * identifier referenced by nested `product_group_member.group` rows
 * and editing it would orphan those references. The threshold-profile
 * update endpoint uses the same convention.
 *
 * `scopeId` is also rejected — tenant-created groups stay org-scoped
 * for life. Changing scope mid-lifecycle is a future migration flow.
 *
 * Enforces mutability:
 *   - 404 if the group is missing or soft-deleted
 *   - 403 if the group is system-scope OR belongs to another client
 *
 * Loads the group + caller-owned scope onto res.locals so the
 * controller doesn't re-query.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { IsNull, Not } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  PRODUCT_GROUP as PG_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ProductGroup } from '../../../shared/db/entities/product-group.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const ALLOWED_LEVELS = [
  'ingredient',
  'product_family',
  'product_name',
  'trade_name',
] as const;

const memberSchema = Joi.object({
  memberType: Joi.string().valid('product').required().messages({
    'any.only': 'Only product members are accepted on update',
    'any.required': 'memberType is required',
  }),
  sourceSystem: Joi.string().trim().min(1).max(64).required().messages({
    'string.empty': 'sourceSystem is required',
    'any.required': 'sourceSystem is required',
  }),
  level: Joi.string()
    .trim()
    .lowercase()
    .valid(...ALLOWED_LEVELS)
    .required()
    .messages({
      'any.only': `level must be one of: ${ALLOWED_LEVELS.join(', ')}`,
      'any.required': 'level is required',
    }),
  name: Joi.string().trim().min(1).max(255).required().messages({
    'string.empty': 'name is required',
    'any.required': 'name is required',
  }),
  code: Joi.string().trim().max(64).optional().allow('', null),
});

const schema = Joi.object({
  name: Joi.string().trim().min(2).max(128).optional().messages({
    'string.min': 'Name must be at least 2 characters',
    'string.max': 'Name must not exceed 128 characters',
  }),
  description: Joi.string().trim().max(500).optional().allow('', null),
  isEnabled: Joi.boolean().optional(),
  members: Joi.array().items(memberSchema).min(1).required().messages({
    'array.min': 'At least one member is required',
    'any.required': 'members is required',
  }),
});

const UpdateProductGroupValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return sendResponse(res, false, CODE.BAD_REQUEST, PG_MSG.NOT_FOUND);
    }

    const { error, value } = validateSchema(schema, req.body);
    if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);
    req.body = value;

    /* Resolve the target row. Soft-deleted rows are treated as
     * missing — the FE shouldn't be able to PUT them back to life
     * via this endpoint. */
    const group = await AppDataSource.getRepository(ProductGroup)
      .createQueryBuilder('pg')
      .leftJoinAndSelect('pg.scope', 'scope')
      .where('pg.product_group_id = :id', { id })
      .andWhere('pg.deleted_on IS NULL')
      .getOne();

    if (!group) {
      return sendResponse(res, false, CODE.NOT_FOUND, PG_MSG.NOT_FOUND);
    }

    /* Server-side mutability check — the FE already hides Edit on
     * canEdit:false, but the BE re-runs the rule so a hand-rolled
     * request can't bypass it. */
    const callerClientCode: string | null =
      res.locals.clientData?.clientCode ?? null;
    const isSystem = group.scope?.code === 'system';
    const ownsRow =
      !!callerClientCode && group.clientId === callerClientCode;
    if (isSystem || !ownsRow) {
      return sendResponse(res, false, CODE.FORBIDDEN, PG_MSG.IMMUTABLE);
    }

    /* If the name changes, double-check there's no other live group
     * with the same code at this (client, scope). Code itself is
     * immutable so we don't recheck it — but a name change can still
     * collide with a stale soft-deleted row's name if anyone tries
     * to restore it. Cheap insurance. */
    if (value.name && value.name !== group.name) {
      const collision = await AppDataSource.getRepository(ProductGroup).findOne(
        {
          where: {
            clientId:
              callerClientCode === null ? IsNull() : callerClientCode,
            scopeId: group.scopeId,
            name: value.name,
            productGroupId: Not(id),
            deletedOn: IsNull(),
          },
        },
      );
      if (collision) {
        return sendResponse(
          res,
          false,
          CODE.ALREADY_EXISTS,
          PG_MSG.ALREADY_EXISTS,
        );
      }
    }

    res.locals.productGroup = group;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default UpdateProductGroupValidation;
```

### 2.14 Controller — Update (full source)

**File:** `src/modules/product-groups/controllers/updateProductGroup.ts`

```typescript
/**
 * updateProductGroup — PUT /api/v1/product-groups/:id.
 *
 * Validator already:
 *   - resolved the target row into `res.locals.productGroup`
 *   - rejected system-scope / cross-tenant edits with 403
 *   - validated the body shape (members[] non-empty)
 *
 * Update strategy is **wholesale replace** for members — the FE
 * thinks of the picker output as the canonical set, not a delta.
 * Diffing here would let stale picker state ghost-survive a save.
 * Transaction:
 *   1. update parent row (name / description / isEnabled / updatedBy)
 *   2. hard-delete prior member rows for this group
 *      (history isn't preserved; soft-deleting them would just clutter
 *       the table and force every read to filter)
 *   3. insert the freshly-picked member rows
 *
 * If any step fails the whole thing rolls back — the parent never
 * ends up with an empty member set.
 *
 * Permission: `productGroup` WRITE.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  PRODUCT_GROUP as PG_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ProductGroup } from '../../../shared/db/entities/product-group.entity';
import { ProductGroupMember } from '../../../shared/db/entities/product-group-member.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

interface UpdateBody {
  name?: string;
  description?: string | null;
  isEnabled?: boolean;
  members: Array<{
    memberType: 'product';
    sourceSystem: string;
    level: string;
    name: string;
    code?: string | null;
  }>;
}

const updateProductGroup = async (req: Request, res: Response) => {
  Logger.info('Update Product Group request');

  const { name, description, isEnabled, members } = req.body as UpdateBody;
  const target = res.locals.productGroup as ProductGroup;
  const { loggedInId } = res.locals;

  try {
    const result = await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        const groupRepo = manager.getRepository(ProductGroup);
        const memberRepo = manager.getRepository(ProductGroupMember);

        if (name !== undefined) target.name = name;
        if (description !== undefined) target.description = description ?? null;
        if (isEnabled !== undefined) target.isEnabled = isEnabled;
        target.updatedBy = loggedInId ?? null;
        const savedGroup = await groupRepo.save(target);

        /* Hard-delete prior members — wholesale-replace semantics.
         * (Soft-delete would leave history rows that complicate every
         * read path; the FE picker is the canonical source.) */
        await memberRepo.delete({ productGroupId: target.productGroupId });

        const newMembers = members.map(m =>
          memberRepo.create({
            productGroupId: target.productGroupId,
            memberType: 'product',
            sourceSystem: m.sourceSystem,
            level: m.level,
            name: m.name,
            code: m.code?.trim() || null,
          }),
        );
        const savedMembers = await memberRepo.save(newMembers);

        return { group: savedGroup, members: savedMembers };
      },
    );

    sendResponse(res, true, CODE.SUCCESS, PG_MSG.UPDATED, {
      ...result.group,
      members: result.members,
    });
  } catch (error) {
    Logger.error(`Error updating product group: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default updateProductGroup;
```

### 2.15 Validator — Delete (full source)

**File:** `src/modules/product-groups/middleware/deleteProductGroup.validation.ts`

```typescript
/**
 * DeleteProductGroupValidation — `DELETE /api/v1/product-groups/:id`.
 *
 * Same gate as update: 404 on missing / already-deleted, 403 on
 * system-scope / cross-tenant. Soft-delete via TypeORM's
 * `@DeleteDateColumn` (sets `deleted_on`).
 *
 * Loads the row into `res.locals.productGroup` so the controller is
 * pure write logic.
 */
import { NextFunction, Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  PRODUCT_GROUP as PG_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ProductGroup } from '../../../shared/db/entities/product-group.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const DeleteProductGroupValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return sendResponse(res, false, CODE.BAD_REQUEST, PG_MSG.NOT_FOUND);
    }

    const group = await AppDataSource.getRepository(ProductGroup)
      .createQueryBuilder('pg')
      .leftJoinAndSelect('pg.scope', 'scope')
      .where('pg.product_group_id = :id', { id })
      .andWhere('pg.deleted_on IS NULL')
      .getOne();

    if (!group) {
      return sendResponse(res, false, CODE.NOT_FOUND, PG_MSG.NOT_FOUND);
    }

    const callerClientCode: string | null =
      res.locals.clientData?.clientCode ?? null;
    const isSystem = group.scope?.code === 'system';
    const ownsRow =
      !!callerClientCode && group.clientId === callerClientCode;
    if (isSystem || !ownsRow) {
      return sendResponse(res, false, CODE.FORBIDDEN, PG_MSG.IMMUTABLE);
    }

    res.locals.productGroup = group;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default DeleteProductGroupValidation;
```

### 2.16 Controller — Delete (full source)

**File:** `src/modules/product-groups/controllers/deleteProductGroup.ts`

```typescript
/**
 * deleteProductGroup — DELETE /api/v1/product-groups/:id.
 *
 * Soft-deletes the parent group via TypeORM's `softRemove` (sets
 * `deleted_on = now()`) and stamps the caller's id into `deleted_by`.
 *
 * Members are intentionally NOT soft-deleted in lockstep: the
 * `ON DELETE CASCADE` foreign key would cover a hard delete, and the
 * list / read controllers already filter parents by `deleted_on IS
 * NULL`, so members of a soft-deleted group never surface anyway.
 * Keeping member rows lets a future "restore" flow (out of scope
 * for this turn) bring the original picks back.
 *
 * Permission: `productGroup` FULL.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  PRODUCT_GROUP as PG_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ProductGroup } from '../../../shared/db/entities/product-group.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const deleteProductGroup = async (_req: Request, res: Response) => {
  Logger.info('Delete Product Group request');

  const target = res.locals.productGroup as ProductGroup;
  const { loggedInId } = res.locals;

  try {
    target.deletedBy = loggedInId ?? null;
    /* Save first so deletedBy lands on disk, then softRemove sets
     * deletedOn in one separate statement. softRemove on its own
     * doesn't take a deletedBy hint. */
    await AppDataSource.getRepository(ProductGroup).save(target);
    await AppDataSource.getRepository(ProductGroup).softRemove(target);

    sendResponse(res, true, CODE.SUCCESS, PG_MSG.DELETED);
  } catch (error) {
    Logger.error(`Error deleting product group: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default deleteProductGroup;
```

### 2.17 Routes (full source)

**File:** `src/modules/product-groups/product-groups.routes.ts`

```typescript
/**
 * Product Group routes — mounted at /api/v1/product-groups.
 *
 *   GET    /        → paginated / filterable / sortable list. Optional
 *                     `?includeMembers=true` to inline member rows;
 *                     default returns lean rows with `memberCount`
 *                     only.
 *   POST   /        → create a new group + its members atomically.
 *   GET    /:id     → single group + its members (read-only fetch
 *                     used by View / Edit screens).
 *   PUT    /:id     → update name / description / status + wholesale-
 *                     replace members.
 *   DELETE /:id     → soft-delete the group (and implicitly its
 *                     members, since list / get filter by parent).
 *
 * Permission gating:
 *   - READ  → list, get
 *   - WRITE → create, update
 *   - FULL  → delete
 *
 * Future bulk-delete endpoint slots in cleanly here.
 */
import { Router } from 'express';
import { ACCESS } from '../../shared/constants/permissions/access';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import VerifyResourceMiddleware from '../../shared/middleware/verifyResource.middleware';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import addProductGroup from './controllers/addProductGroup';
import deleteProductGroup from './controllers/deleteProductGroup';
import getProductGroup from './controllers/getProductGroup';
import listProductGroup from './controllers/listProductGroup';
import updateProductGroup from './controllers/updateProductGroup';
import AddProductGroupValidation from './middleware/addProductGroup.validation';
import DeleteProductGroupValidation from './middleware/deleteProductGroup.validation';
import GetProductGroupValidation from './middleware/getProductGroup.validation';
import ListProductGroupValidation from './middleware/listProductGroup.validation';
import UpdateProductGroupValidation from './middleware/updateProductGroup.validation';

const router = Router();

router.get(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('productGroup', ACCESS.READ),
  VerifyResourceMiddleware,
  ListProductGroupValidation,
  listProductGroup,
);

router.post(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('productGroup', ACCESS.WRITE),
  VerifyResourceMiddleware,
  AddProductGroupValidation,
  addProductGroup,
);

router.get(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('productGroup', ACCESS.READ),
  VerifyResourceMiddleware,
  GetProductGroupValidation,
  getProductGroup,
);

router.put(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('productGroup', ACCESS.WRITE),
  VerifyResourceMiddleware,
  UpdateProductGroupValidation,
  updateProductGroup,
);

router.delete(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('productGroup', ACCESS.FULL),
  VerifyResourceMiddleware,
  DeleteProductGroupValidation,
  deleteProductGroup,
);

export default router;
```

### 2.18 Route mount — `src/server.ts`

Two-line patch:

```typescript
import productBrowserRoutes from './modules/product-browser/product-browser.routes';
import productGroupRoutes from './modules/product-groups/product-groups.routes';
```

…and in the route-mounting block:

```typescript
this.app.use('/api/v1/product-browser', productBrowserRoutes);
this.app.use('/api/v1/product-groups', productGroupRoutes);
```

### 2.19 Response messages

**File:** `src/shared/constants/response.messages.ts` — `PRODUCT_GROUP` block added:

```typescript
// Product Browser
export const PRODUCT_BROWSER = {
  LIST_FETCHED: 'product_browser.list_fetched',
};

// Product Group
export const PRODUCT_GROUP = {
  LIST_FETCHED: 'product_group.list_fetched',
  FETCHED: 'product_group.fetched',
  CREATED: 'product_group.created',
  UPDATED: 'product_group.updated',
  DELETED: 'product_group.deleted',
  ALREADY_EXISTS: 'product_group.already_exists',
  SCOPE_INVALID: 'product_group.scope_invalid',
  NOT_FOUND: 'product_group.not_found',
  IMMUTABLE: 'product_group.immutable',
};
```

---

## 3. Wire endpoints — caller summary

| Verb | URL | Permission | Body / Query | Returns |
|---|---|---|---|---|
| `POST` | `/api/v1/product-browser/search` | `productGroup` READ | `{ type, filter, searchedValue, level, sourceSystem? }` | `{ ingredients, pFamily, pName, tradeName }` per-item with `sourceSystem` echoed |
| `GET`  | `/api/v1/product-groups`           | `productGroup` READ | `?page&limit&filter(json)&sort&includeMembers` | `{ count, productGroups[] }` (with `memberCount` or full `members[]`) |
| `POST` | `/api/v1/product-groups`           | `productGroup` WRITE | `{ code, name, description?, isEnabled?, members[] }` | created group + members |
| `GET`  | `/api/v1/product-groups/:id`       | `productGroup` READ | – | group + members + `canEdit/canDelete` |
| `PUT`  | `/api/v1/product-groups/:id`       | `productGroup` WRITE | `{ name?, description?, isEnabled?, members[] }` | updated group + new member set |
| `DELETE` | `/api/v1/product-groups/:id`     | `productGroup` FULL | – | – (soft-deleted) |

**Mutability rule** applied identically by every write/delete validator:
`scope.code !== 'system'` AND `clientId === caller.clientCode` ⇒ allowed; otherwise 403 `IMMUTABLE`.

---

## 4. What's still pending

- Bulk-delete endpoint (`POST /api/v1/product-groups/bulk-delete`) — pattern mirrors users / roles.
- Nested-group member writes — the entity supports `member_type='group'` with `parent_product_group_id`, but the Add / Update validators only accept product members for now.
- A restore flow — `deleted_on IS NULL` + intact member rows make this trivial when needed; the controller skeleton would be a new endpoint that nulls `deleted_on`.
- `fe-integration.md` still describes `sourceSystem` as required on both `type=0` and `type=1`. Once this branch merges, update §3 (Product Browser) to reflect the conditional rule documented above.

---

## 5. FE consumers

- **Product picker dialog** (`src/app/common/components/dialogs/product-selector-dialog/`) — calls `POST /api/v1/product-browser/search`. Mode 0 (Search button) omits `sourceSystem`; Mode 1 (card click) reads the clicked option's per-item `sourceSystem` and forwards it.
- **List Product Group screen** (`src/app/modules/product-groups/components/list-product-group/`) — calls `GET /api/v1/product-groups`. Surfaces `canEdit / canDelete` per row to gate action buttons. Filters: Name, Description, Scope, Status (Active/Inactive), Created date range.
- **Add Product Group form** (`src/app/modules/product-groups/components/add-product-group/`) — embeds the picker; criteria emitted on Apply. Posts to `POST /api/v1/product-groups`. Field order: Name → Code → Description, then Members section with an icon-only Select Products button.
- **View Product Group screen** (`src/app/modules/product-groups/components/view-product-group/`) — calls `GET /api/v1/product-groups/:id`. Read-only members table; Edit / Delete buttons gated by `canEdit` / `canDelete`.
- **Edit Product Group form** (`src/app/modules/product-groups/components/edit-product-group/`) — hydrates from `GET /:id`, sends `PUT /:id` on Save. Code is read-only; Reset Members button restores the on-load snapshot of the picker without touching metadata edits. Picker is pre-filled with current members; Apply replaces the working set (dialog handles dup detection inside, the Edit page additionally dedupes on apply by `(type, code-or-name)`).
- **Service layer** (`src/app/modules/product-groups/services/product-group.service.ts`) — bidirectional mapping between BE rows (one row per member) and the FE picker's `CriteriaEntry[]` (grouped by level). Add-click grouping isn't persisted; on read we assign one `criteriaNumber` per level so the picker's merge-by-level view treats the saved set as a single coherent member.
