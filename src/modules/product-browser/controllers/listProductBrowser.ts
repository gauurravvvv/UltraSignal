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
