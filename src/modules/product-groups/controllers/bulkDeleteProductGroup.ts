/**
 * bulkDeleteProductGroup — hard-deletes mappings for all selected groups in
 * one IN-clause, then soft-deletes each group.
 *
 * `softRemove` runs per group in the loop because TypeORM needs to set each
 * entity's `deletedOn` individually.
 */
import { Request, Response } from 'express';
import { EntityManager, In } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  PRODUCT_GROUP as PG_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ProductGroup } from '../../../shared/db/entities/productGroup.entity';
import { ProductGroupMapping } from '../../../shared/db/entities/productGroupMapping.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const bulkDeleteProductGroup = async (req: Request, res: Response) => {
  Logger.info(`Bulk delete Product Group request`);

  const { loggedInId, productGroups } = res.locals;

  try {
    const ids: string[] = productGroups.map((g: ProductGroup) => g.id);

    await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        await manager
          .getRepository(ProductGroupMapping)
          .delete({ productGroupId: In(ids) });

        for (const group of productGroups) {
          group.deletedBy = loggedInId;
          await manager.getRepository(ProductGroup).save(group);
          await manager.getRepository(ProductGroup).softRemove(group);
        }
      },
    );

    sendResponse(res, true, CODE.SUCCESS, PG_MSG.BULK_DELETED, {
      deletedCount: ids.length,
      deletedIds: ids,
    });
  } catch (error) {
    Logger.error(
      `Error bulk deleting product groups: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default bulkDeleteProductGroup;
