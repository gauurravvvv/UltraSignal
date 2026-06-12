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
  ProductBrowserLevel,
  ProductBrowserSearchType,
  SEARCH_TYPE_HIERARCHY,
} from '../middleware/listProductBrowser.validation';

const BROWSER_LIMIT = 50;

interface SearchedItem {
  name: string;
  code: string;
  original_name: string;
}

interface SearchedResponse {
  ingredients: SearchedItem[];
  pFamily: SearchedItem[];
  pName: SearchedItem[];
  tradeName: SearchedItem[];
}

const baseQuery = (sourceSystem: string) =>
  AppDataSource.getRepository(ProductBrowser)
    .createQueryBuilder('pb')
    .where('pb.source_system = :sourceSystem', { sourceSystem });

const queryIngredients = async (
  searchedValue: string,
  sourceSystem: string,
): Promise<SearchedItem[]> => {
  const rows = await baseQuery(sourceSystem)
    .select(['pb.ingredient_id AS ingredient_id', 'pb.ingredient_name AS ingredient_name'])
    .andWhere('pb.ingredient_name ILIKE :term', { term: `%${searchedValue}%` })
    .distinctOn(['pb.ingredient_name'])
    .limit(BROWSER_LIMIT)
    .getRawMany();
  return rows
    .filter(r => r.ingredient_name)
    .map(r => ({
      name: r.ingredient_name,
      code: r.ingredient_id,
      original_name: r.ingredient_name,
    }));
};

const queryFamily = async (
  searchedValue: string,
  sourceSystem: string,
): Promise<SearchedItem[]> => {
  const rows = await baseQuery(sourceSystem)
    .select(['pb.family_id AS family_id', 'pb.family_name AS family_name'])
    .andWhere('pb.family_name ILIKE :term', { term: `%${searchedValue}%` })
    .distinctOn(['pb.family_name'])
    .limit(BROWSER_LIMIT)
    .getRawMany();
  return rows
    .filter(r => r.family_name)
    .map(r => ({
      name: r.family_name,
      code: r.family_id,
      original_name: r.family_name,
    }));
};

const queryProductName = async (
  searchedValue: string,
  sourceSystem: string,
): Promise<SearchedItem[]> => {
  const rows = await baseQuery(sourceSystem)
    .select([
      'pb.product_id AS product_id',
      'pb.product_name AS product_name',
      'pb.product_name_display AS product_name_display',
    ])
    .andWhere('pb.product_name ILIKE :term', { term: `%${searchedValue}%` })
    .distinctOn(['pb.product_name'])
    .limit(BROWSER_LIMIT)
    .getRawMany();
  return rows
    .filter(r => r.product_name)
    .map(r => ({
      name: r.product_name_display ?? r.product_name,
      code: r.product_id,
      original_name: r.product_name,
    }));
};

const queryTradeName = async (
  searchedValue: string,
  sourceSystem: string,
): Promise<SearchedItem[]> => {
  const rows = await baseQuery(sourceSystem)
    .select([
      'pb.trade_id AS trade_id',
      'pb.trade_name AS trade_name',
      'pb.trade_name_display AS trade_name_display',
    ])
    .andWhere('pb.trade_name ILIKE :term', { term: `%${searchedValue}%` })
    .distinctOn(['pb.trade_name'])
    .limit(BROWSER_LIMIT)
    .getRawMany();
  return rows
    .filter(r => r.trade_name)
    .map(r => ({
      name: r.trade_name_display ?? r.trade_name,
      code: r.trade_id,
      original_name: r.trade_name,
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
}
const hierarchyIngredient = async (
  searchedValue: string,
  sourceSystem: string,
): Promise<IngredientHierarchyRow[]> => {
  return baseQuery(sourceSystem)
    .select(['pb.family_id AS family_id', 'pb.family_name AS family_name'])
    .andWhere('pb.ingredient_name = :value', { value: searchedValue })
    .distinctOn(['pb.family_name'])
    .limit(BROWSER_LIMIT)
    .getRawMany();
};

interface FamilyHierarchyRow {
  ingredient_id: string;
  ingredient_name: string;
  product_id: string;
  product_name: string;
  product_name_display: string | null;
}
const hierarchyFamily = async (
  searchedValue: string,
  sourceSystem: string,
): Promise<FamilyHierarchyRow[]> => {
  return baseQuery(sourceSystem)
    .select([
      'pb.ingredient_id AS ingredient_id',
      'pb.ingredient_name AS ingredient_name',
      'pb.product_id AS product_id',
      'pb.product_name AS product_name',
      'pb.product_name_display AS product_name_display',
    ])
    .andWhere('pb.family_name = :value', { value: searchedValue })
    .distinctOn(['pb.ingredient_name', 'pb.product_name'])
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
}
const hierarchyProductName = async (
  searchedValue: string,
  sourceSystem: string,
): Promise<ProductHierarchyRow[]> => {
  return baseQuery(sourceSystem)
    .select([
      'pb.ingredient_id AS ingredient_id',
      'pb.ingredient_name AS ingredient_name',
      'pb.family_id AS family_id',
      'pb.family_name AS family_name',
      'pb.trade_id AS trade_id',
      'pb.trade_name AS trade_name',
      'pb.trade_name_display AS trade_name_display',
    ])
    .andWhere('pb.product_name = :value', { value: searchedValue })
    .distinctOn(['pb.ingredient_name', 'pb.family_name', 'pb.trade_name'])
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
}
const hierarchyTradeName = async (
  searchedValue: string,
  sourceSystem: string,
): Promise<TradeHierarchyRow[]> => {
  return baseQuery(sourceSystem)
    .select([
      'pb.ingredient_id AS ingredient_id',
      'pb.ingredient_name AS ingredient_name',
      'pb.family_id AS family_id',
      'pb.family_name AS family_name',
      'pb.product_id AS product_id',
      'pb.product_name AS product_name',
      'pb.product_name_display AS product_name_display',
    ])
    .andWhere('pb.trade_name = :value', { value: searchedValue })
    .distinctOn(['pb.ingredient_name', 'pb.family_name', 'pb.product_name'])
    .limit(BROWSER_LIMIT)
    .getRawMany();
};

const searchProductBrowser = async (req: Request, res: Response) => {
  Logger.info('Search Product Browser request');

  const { type, searchedValue, level, sourceSystem } = req.body as {
    type: ProductBrowserSearchType;
    searchedValue: string;
    level: ProductBrowserLevel;
    sourceSystem: string;
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
      switch (level) {
        case 'INGREDIENT': {
          const rows = await hierarchyIngredient(searchedValue, sourceSystem);
          for (const r of rows) {
            if (r.family_name) {
              result.pFamily.push({
                name: r.family_name,
                code: r.family_id,
                original_name: r.family_name,
              });
            }
          }
          break;
        }
        case 'PRODUCT_FAMILY': {
          const rows = await hierarchyFamily(searchedValue, sourceSystem);
          for (const r of rows) {
            if (r.ingredient_name) {
              result.ingredients.push({
                name: r.ingredient_name,
                code: r.ingredient_id,
                original_name: r.ingredient_name,
              });
            }
            if (r.product_name) {
              result.pName.push({
                name: r.product_name_display ?? r.product_name,
                code: r.product_id,
                original_name: r.product_name,
              });
            }
          }
          break;
        }
        case 'PRODUCT_NAME': {
          const rows = await hierarchyProductName(searchedValue, sourceSystem);
          for (const r of rows) {
            if (r.ingredient_name) {
              result.ingredients.push({
                name: r.ingredient_name,
                code: r.ingredient_id,
                original_name: r.ingredient_name,
              });
            }
            if (r.family_name) {
              result.pFamily.push({
                name: r.family_name,
                code: r.family_id,
                original_name: r.family_name,
              });
            }
            if (r.trade_name) {
              result.tradeName.push({
                name: r.trade_name_display ?? r.trade_name,
                code: r.trade_id,
                original_name: r.trade_name,
              });
            }
          }
          break;
        }
        case 'TRADE_NAME': {
          const rows = await hierarchyTradeName(searchedValue, sourceSystem);
          for (const r of rows) {
            if (r.ingredient_name) {
              result.ingredients.push({
                name: r.ingredient_name,
                code: r.ingredient_id,
                original_name: r.ingredient_name,
              });
            }
            if (r.family_name) {
              result.pFamily.push({
                name: r.family_name,
                code: r.family_id,
                original_name: r.family_name,
              });
            }
            if (r.product_name) {
              result.pName.push({
                name: r.product_name_display ?? r.product_name,
                code: r.product_id,
                original_name: r.product_name,
              });
            }
          }
          break;
        }
      }
    } else {
      // type=0 — search. ILIKE on the chosen level's name column.
      switch (level) {
        case 'INGREDIENT':
          result.ingredients = await queryIngredients(searchedValue, sourceSystem);
          break;
        case 'PRODUCT_FAMILY':
          result.pFamily = await queryFamily(searchedValue, sourceSystem);
          break;
        case 'PRODUCT_NAME':
          result.pName = await queryProductName(searchedValue, sourceSystem);
          break;
        case 'TRADE_NAME':
          result.tradeName = await queryTradeName(searchedValue, sourceSystem);
          break;
        case 'ALL': {
          const [ingredients, pFamily, pName, tradeName] = await Promise.all([
            queryIngredients(searchedValue, sourceSystem),
            queryFamily(searchedValue, sourceSystem),
            queryProductName(searchedValue, sourceSystem),
            queryTradeName(searchedValue, sourceSystem),
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
