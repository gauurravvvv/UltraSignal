/**
 * updateProductGroup — replaces the full member list atomically alongside
 * group metadata changes.
 *
 * Members are deleted and re-inserted (rather than diff-patched) because the
 * UI always sends the complete desired member set. The delete + insert runs
 * inside a transaction so the group is never temporarily empty.
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

interface MemberInput {
  memberId: string;
  level?: string;
  language?: string;
  sourceId?: number;
}

const updateProductGroup = async (req: Request, res: Response) => {
  Logger.info(`Update Product Group request`);

  const { id, name, description, sourceId, status, members } = req.body as {
    id: string;
    name?: string;
    description?: string;
    sourceId?: number;
    status?: number;
    members?: MemberInput[];
  };
  const { loggedInId, productGroup, clientData } = res.locals;

  try {
    productGroup.name = name ?? productGroup.name;
    productGroup.description =
      description !== undefined ? description : productGroup.description;
    if (sourceId !== undefined) productGroup.sourceId = sourceId;
    if (status !== undefined) productGroup.status = status;
    productGroup.updatedBy = loggedInId;

    let result!: ProductGroup;
    await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        // Replace members wholesale
        await manager
          .getRepository(ProductGroupMapping)
          .delete({ productGroupId: id });

        if (members && members.length > 0) {
          const mappings = members.map(m => ({
            productGroupId: id,
            memberId: m.memberId,
            clientId: clientData.id,
            sourceId: (m.sourceId ?? productGroup.sourceId) as number,
            language: m.language ?? 'en',
            level: m.level ?? 'product',
            createdBy: loggedInId,
          }));
          await manager.getRepository(ProductGroupMapping).insert(mappings);
        }

        result = await manager.getRepository(ProductGroup).save(productGroup);
      },
    );

    sendResponse(res, true, CODE.SUCCESS, PG_MSG.UPDATED, result);
  } catch (error) {
    Logger.error(`Error updating product group: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default updateProductGroup;
