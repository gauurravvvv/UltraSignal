/**
 * addProductGroup — creates a Product Group and atomically seeds its members.
 *
 * The ProductGroup row and its ProductGroupMapping rows commit in a single
 * transaction so the group is never visible without its intended member set.
 *
 * `members` carries the picks the analyst made in the Product Browser. Each
 * entry references a ProductBrowser row id + the `level` it was picked at
 * (ingredient / product / trade) so the runtime engine knows how to expand
 * the member when an alert runs.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import { CODE, STATUS } from '../../../../config/config';
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

const addProductGroup = async (req: Request, res: Response) => {
  Logger.info(`Add Product Group request`);

  const { name, description, sourceId, status, members } = req.body as {
    name: string;
    description?: string;
    sourceId?: number;
    status?: number;
    members?: MemberInput[];
  };
  const { loggedInId, clientData } = res.locals;

  try {
    const group = new ProductGroup();
    group.name = name;
    group.description = description ?? '';
    group.clientId = clientData.id;
    group.clientName = clientData.name;
    group.sourceId = sourceId as number;
    group.status = status ?? STATUS.ACTIVE;
    group.createdBy = loggedInId;

    let saved!: ProductGroup;
    await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        saved = await manager.getRepository(ProductGroup).save(group);

        if (members && members.length > 0) {
          const mappings = members.map(m => {
            const mapping = new ProductGroupMapping();
            mapping.productGroupId = saved.id;
            mapping.memberId = m.memberId;
            mapping.clientId = clientData.id;
            mapping.sourceId = (m.sourceId ?? sourceId) as number;
            mapping.language = m.language ?? 'en';
            mapping.level = m.level ?? 'product';
            mapping.createdBy = loggedInId;
            return mapping;
          });
          await manager.getRepository(ProductGroupMapping).save(mappings);
        }
      },
    );

    sendResponse(res, true, CODE.SUCCESS, PG_MSG.CREATED, saved);
  } catch (error) {
    Logger.error(`Error creating Product Group: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default addProductGroup;
