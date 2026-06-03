/**
 * deleteSystemAdmin — soft-deletes a single system admin.
 *
 * Soft-delete (TypeORM's softRemove) sets deletedAt rather than removing the
 * row, preserving the audit trail and foreign key references. The deletedBy
 * field is stamped first so we know which admin performed the deletion.
 *
 * Both operations run inside a single transaction to ensure we never write a
 * deletedBy without also completing the soft-delete (and vice versa).
 *
 * Guards against self-deletion and default-admin deletion are in the
 * validation middleware, not here — by the time this handler runs, those
 * checks have already passed.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  SYSTEM_ADMIN as SYSTEM_ADMIN_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const deleteSystemAdmin = async (req: Request, res: Response) => {
  Logger.info(`Delete super admin request`);

  const { loggedInId, systemAdmin } = res.locals;

  try {
    let result: any;
    await AppDataSource.transaction(async (manager: EntityManager) => {
      systemAdmin.deletedBy = loggedInId;
      await manager.save(systemAdmin);
      result = await manager.softRemove(systemAdmin);
    });

    sendResponse(res, true, CODE.SUCCESS, SYSTEM_ADMIN_MSG.DELETED, result);
  } catch (error) {
    Logger.error(`Error in deleteSystemAdmin: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default deleteSystemAdmin;
