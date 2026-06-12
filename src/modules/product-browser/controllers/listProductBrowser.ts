/**
 * listProductBrowser — search the `product_browser` reference catalog.
 *
 * Given (level, product, sourceSystem) the controller picks the
 * `<level>_name` column (e.g. level=ingredient → ingredient_name),
 * runs a case-insensitive ILIKE on the supplied search term within
 * the rows whose `source_system` matches, and returns the paginated
 * result.
 *
 * `level` → column map mirrors the whitelist in the validator. Direct
 * string interpolation into the SQL is safe because both sides only
 * accept the four whitelisted values.
 *
 * Ordering: by the matched level's id ASC, then row id ASC as a stable
 * tie-breaker. That way the FE always sees the same order for the
 * same search.
 */
import { Request, Response } from 'express';
import { CODE, DEFAULT_PAGE, MAX_ROW } from '../../../../config/config';
import {
  GENERIC,
  PRODUCT_BROWSER as PB_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ProductBrowser } from '../../../shared/db/entities/product-browser.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { ProductBrowserLevel } from '../middleware/listProductBrowser.validation';

const COLUMN_BY_LEVEL: Record<ProductBrowserLevel, { name: string; id: string }> = {
  ingredient: { name: 'ingredient_name', id: 'ingredient_id' },
  family: { name: 'family_name', id: 'family_id' },
  product: { name: 'product_name', id: 'product_id' },
  trade: { name: 'trade_name', id: 'trade_id' },
};

const listProductBrowser = async (req: Request, res: Response) => {
  Logger.info('Search Product Browser request');

  const {
    level,
    product,
    sourceSystem,
    page = DEFAULT_PAGE,
    limit = MAX_ROW,
  } = req.query as unknown as {
    level: ProductBrowserLevel;
    product: string;
    sourceSystem: string;
    page?: number;
    limit?: number;
  };

  try {
    const cols = COLUMN_BY_LEVEL[level];

    const query = AppDataSource.getRepository(ProductBrowser)
      .createQueryBuilder('pb')
      .where('pb.source_system = :sourceSystem', { sourceSystem })
      .andWhere(`pb.${cols.name} ILIKE :term`, { term: `%${product}%` })
      .orderBy(`pb.${cols.id}`, 'ASC')
      .addOrderBy('pb.id', 'ASC');

    const [rows, count] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    sendResponse(res, true, CODE.SUCCESS, PB_MSG.LIST_FETCHED, {
      count,
      level,
      products: rows,
    });
  } catch (error) {
    Logger.error(
      `Error searching product browser: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default listProductBrowser;
