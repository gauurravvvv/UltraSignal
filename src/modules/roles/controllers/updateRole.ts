/**
 * updateRole — applies partial updates to a role using the pre-fetched entity.
 *
 * Default role guard runs in middleware (not here) — by the time this controller
 * runs, `res.locals.role` is guaranteed to be non-default and client-scoped.
 */
import { Request, Response } from 'express';
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

const updateRole = async (req: Request, res: Response) => {
  Logger.info('Update Role request');

  const { name, description, selectedPermissions, status } = req.body;
  const { loggedInId, role } = res.locals;

  try {
    role.name = name ?? role.name;
    role.description =
      description !== undefined ? description : role.description;
    role.permissions =
      selectedPermissions !== undefined
        ? JSON.stringify(selectedPermissions)
        : role.permissions;
    role.status = status !== undefined ? status : role.status;
    role.updatedBy = loggedInId;

    const saved = await AppDataSource.getRepository(Role).save(role);

    sendResponse(res, true, CODE.SUCCESS, ROLE_MSG.UPDATED, saved);
  } catch (error) {
    Logger.error(`Error while updating role: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default updateRole;
