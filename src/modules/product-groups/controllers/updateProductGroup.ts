/**
 * updateProductGroup — PUT /api/v1/product-groups/:id.
 *
 * Validator already:
 *   - resolved the target row into `res.locals.productGroup`
 *   - rejected system-scope / cross-tenant edits with 403
 *   - validated the body shape (members[] non-empty)
 *
 * Update strategy is **wholesale replace** for members — the FE
 * thinks of the picker output as the canonical set, not a delta.
 * Diffing here would let stale picker state ghost-survive a save.
 * Transaction:
 *   1. update parent row (name / description / isEnabled / updatedBy)
 *   2. hard-delete prior member rows for this group
 *      (history isn't preserved; soft-deleting them would just clutter
 *       the table and force every read to filter)
 *   3. insert the freshly-picked member rows
 *
 * If any step fails the whole thing rolls back — the parent never
 * ends up with an empty member set.
 *
 * Permission: `productGroup` WRITE.
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

interface UpdateBody {
  name?: string;
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

const updateProductGroup = async (req: Request, res: Response) => {
  Logger.info('Update Product Group request');

  const { name, description, isEnabled, members } = req.body as UpdateBody;
  const target = res.locals.productGroup as ProductGroup;
  const { loggedInId } = res.locals;

  try {
    const result = await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        const groupRepo = manager.getRepository(ProductGroup);
        const memberRepo = manager.getRepository(ProductGroupMember);

        if (name !== undefined) target.name = name;
        if (description !== undefined) target.description = description ?? null;
        if (isEnabled !== undefined) target.isEnabled = isEnabled;
        target.updatedBy = loggedInId ?? null;
        const savedGroup = await groupRepo.save(target);

        /* Hard-delete prior members — wholesale-replace semantics.
         * (Soft-delete would leave history rows that complicate every
         * read path; the FE picker is the canonical source.) */
        await memberRepo.delete({ productGroupId: target.productGroupId });

        const newMembers = members.map(m =>
          memberRepo.create({
            productGroupId: target.productGroupId,
            memberType: 'product',
            sourceSystem: m.sourceSystem,
            level: m.level,
            name: m.name,
            code: m.code?.trim() || null,
          }),
        );
        const savedMembers = await memberRepo.save(newMembers);

        return { group: savedGroup, members: savedMembers };
      },
    );

    sendResponse(res, true, CODE.SUCCESS, PG_MSG.UPDATED, {
      ...result.group,
      members: result.members,
    });
  } catch (error) {
    Logger.error(`Error updating product group: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default updateProductGroup;
