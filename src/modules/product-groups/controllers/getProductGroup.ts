/**
 * getProductGroup — GET /api/v1/product-groups/:id. The validator
 * pre-loaded the group + scope + members onto res.locals, so this
 * controller is pure response shaping.
 *
 * Returns the full group row with `members: ProductGroupMember[]`
 * inlined plus per-row `canEdit` / `canDelete` flags. Same mutability
 * rule as the list controller:
 *   - `scope.code === 'system'`           → false
 *   - `clientId !== caller.clientCode`    → false
 *   - otherwise                           → true
 *
 * Permission: `productGroup` READ.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import { PRODUCT_GROUP as PG_MSG } from '../../../shared/constants/response.messages';
import { ProductGroup } from '../../../shared/db/entities/product-group.entity';
import { ProductGroupMember } from '../../../shared/db/entities/product-group-member.entity';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const getProductGroup = async (_req: Request, res: Response) => {
  Logger.info('Get Product Group request');

  const group = res.locals.productGroup as ProductGroup;
  const members = res.locals.productGroupMembers as ProductGroupMember[];
  const callerClientCode: string | null =
    res.locals.clientData?.clientCode ?? null;

  const isSystem = group.scope?.code === 'system';
  const ownsRow = !!callerClientCode && group.clientId === callerClientCode;
  const isMutable = !isSystem && ownsRow;

  sendResponse(res, true, CODE.SUCCESS, PG_MSG.FETCHED, {
    ...group,
    members,
    canEdit: isMutable,
    canDelete: isMutable,
  });
};

export default getProductGroup;
