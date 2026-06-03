/**
 * GetRoleValidation — resolves and org-scopes the role before the controller runs.
 *
 * The lookup uses both `id` and `organisationId` to prevent an admin from reading
 * a role from a different org by guessing a valid UUID. The pre-fetched `role` is
 * placed in `res.locals` to avoid a duplicate DB query in the controller.
 */
import { NextFunction, Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  ROLE as ROLE_MSG,
} from '../../../shared/constants/response.messages';
import { Role } from '../../../shared/db/entities/role.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { AppDataSource } from '../../../shared/db';

const GetRoleValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const orgId = res.locals.orgData?.id as string;

    const role = await AppDataSource.getRepository(Role).findOne({
      where: { id, organisationId: orgId },
    });

    if (!role) {
      return sendResponse(res, false, CODE.NOT_FOUND, ROLE_MSG.NOT_FOUND);
    }

    res.locals.role = role;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default GetRoleValidation;
