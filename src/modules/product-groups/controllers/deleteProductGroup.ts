/**
 * deleteProductGroup — hard-deletes member mappings, then soft-deletes the group.
 *
 * Mappings are hard-deleted because they're operational state with no recovery
 * value once the group is gone. The group itself is soft-deleted so audit
 * history and any references from Alert Configs survive.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
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

const deleteProductGroup = async (req: Request, res: Response) => {
  Logger.info(`Delete Product Group request`);

  const { id } = req.params;
  const { loggedInId, productGroup } = res.locals;

  try {
    await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        await manager
          .getRepository(ProductGroupMapping)
          .delete({ productGroupId: id });

        productGroup.deletedBy = loggedInId;
        await manager.getRepository(ProductGroup).save(productGroup);
        await manager.getRepository(ProductGroup).softRemove(productGroup);
      },
    );

    sendResponse(res, true, CODE.SUCCESS, PG_MSG.DELETED);
  } catch (error) {
    Logger.error(`Error deleting product group: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default deleteProductGroup;
