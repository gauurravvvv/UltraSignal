/**
 * deleteRole — soft-deletes a role after verifying it has no active assignments.
 *
 * The two-step transaction (set `deletedBy`, then `softDelete`) ensures the audit
 * fields are persisted atomically with the soft-delete timestamp. Without the save
 * inside the transaction, a crash between the two calls would leave a role marked
 * deleted without a record of who deleted it.
 *
 * Assignment validation (no users, no groups) runs in middleware — this controller
 * assumes the role is safe to delete by the time it receives it.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
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

const deleteRole = async (req: Request, res: Response) => {
  Logger.info('Delete Role request');

  const { loggedInId, role } = res.locals;

  try {
    await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        role.deletedBy = loggedInId;
        await manager.getRepository(Role).save(role);
        await manager.getRepository(Role).softDelete(role.id);
      },
    );

    sendResponse(res, true, CODE.SUCCESS, ROLE_MSG.DELETED);
  } catch (error) {
    Logger.error(`Error while deleting role: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default deleteRole;
