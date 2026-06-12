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
