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
