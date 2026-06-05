/**
 * listProduct — paginated/filterable Product Browser for the caller's tenant.
 *
 * Supports text search across ingredient / product name / trade name and
 * a `sourceId` filter so the UI can isolate one source (AEMS/EVDAS/etc.).
 */
import { Request, Response } from 'express';
import { CODE, DEFAULT_PAGE, MAX_ROW } from '../../../../config/config';
import {
  GENERIC,
  PRODUCT as PRODUCT_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ProductBrowser } from '../../../shared/db/entities/products.entity';
import { applySort } from '../../../shared/utility/listSort';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { ProductListSortField } from '../middleware/listProduct.validation';

const SORT_COLUMN_MAP: Record<ProductListSortField, string> = {
  ingredient: 'p.ingredient',
  prodNameDisplay: 'p.prodNameDisplay',
  tradeNameDisplay: 'p.tradeNameDisplay',
  country: 'p.country',
};

const listProduct = async (req: Request, res: Response) => {
  Logger.info(`List Products request`);

  const {
    limit = MAX_ROW,
    page = DEFAULT_PAGE,
    filter,
    search,
    sourceId,
    sort,
  } = req.query as {
    limit?: number;
    page?: number;
    filter?: string;
    search?: string;
    sourceId?: string;
    sort?: string;
  };

  const { clientData } = res.locals;
  const clientId = clientData.id;

  try {
    const qb = AppDataSource.getRepository(ProductBrowser)
      .createQueryBuilder('p')
      .where('p.clientId = :clientId', { clientId })
      .andWhere('p.status = 1');

    if (sourceId !== undefined && sourceId !== '') {
      qb.andWhere('p.sourceId = :sourceId', { sourceId: Number(sourceId) });
    }

    if (search) {
      qb.andWhere(
        `(p.ingredient ILIKE :q OR p.prodNameDisplay ILIKE :q OR p.tradeNameDisplay ILIKE :q OR p.familyName ILIKE :q)`,
        { q: `%${search}%` },
      );
    }

    if (filter) {
      try {
        const parsed = JSON.parse(filter);
        if (parsed.ingredient) {
          qb.andWhere('p.ingredient ILIKE :ing', {
            ing: `%${parsed.ingredient}%`,
          });
        }
        if (parsed.country) {
          qb.andWhere('p.country ILIKE :country', {
            country: `%${parsed.country}%`,
          });
        }
        if (parsed.familyName) {
          qb.andWhere('p.familyName ILIKE :fam', {
            fam: `%${parsed.familyName}%`,
          });
        }
        if (parsed.language) {
          qb.andWhere('p.language = :lang', { lang: parsed.language });
        }
      } catch (err) {
        Logger.error(`listProduct: bad filter JSON — ${err}`);
      }
    }

    applySort(qb, sort, SORT_COLUMN_MAP, 'p.ingredient', 'ASC');
    qb.skip((page - 1) * limit).take(limit);

    const [products, count] = await qb.getManyAndCount();

    sendResponse(res, true, CODE.SUCCESS, PRODUCT_MSG.LIST_FETCHED, {
      count,
      products,
    });
  } catch (error) {
    Logger.error(`Error in listProduct: ${error}`);
    sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default listProduct;
