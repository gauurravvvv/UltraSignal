/**
 * DeleteProductGroupValidation — resolves the group, blocks deletion of
 * default groups, and enforces record-level ownership.
 */
import { NextFunction, Request, Response } from 'express';
import { CODE, IS_DEFAULT, VALIDATION_MESSAGES } from '../../../../config/config';
import {
  CLIENT,
  PRODUCT_GROUP as PG_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { ProductGroup } from '../../../shared/db/entities/productGroup.entity';
import sendResponse from '../../../shared/utility/response';

const DeleteProductGroupValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { id } = req.params;
  const { clientData, loggedInId, permissions } = res.locals;
  const clientId = clientData?.id as string;

  if (!id) {
    return sendResponse(
      res,
      false,
      CODE.BAD_REQUEST,
      VALIDATION_MESSAGES.ID.REQUIRED + ' for product group',
    );
  }

  try {
    const group = await AppDataSource.getRepository(ProductGroup).findOne({
      where: { id, clientId },
    });

    if (!group) {
      return sendResponse(res, false, CODE.NOT_FOUND, PG_MSG.NOT_FOUND);
    }

    if (group.isDefault === IS_DEFAULT.YES) {
      return sendResponse(
        res,
        false,
        CODE.UNAUTHORIZED,
        PG_MSG.CANNOT_MODIFY_DEFAULT,
      );
    }

    const isAdmin =
      Array.isArray(permissions) &&
      permissions.some(
        (p: any) =>
          p.value === 'userManagement' ||
          (p.subPermissions || []).some(
            (sp: any) => sp.value === 'userManagement',
          ),
      );
    if (group.createdBy && group.createdBy !== loggedInId && !isAdmin) {
      return sendResponse(res, false, CODE.UNAUTHORIZED, PG_MSG.NOT_OWNER);
    }

    res.locals.productGroup = group;
  } catch {
    return sendResponse(res, false, CODE.BAD_REQUEST, CLIENT.INVALID_ID);
  }

  next();
};

export default DeleteProductGroupValidation;
