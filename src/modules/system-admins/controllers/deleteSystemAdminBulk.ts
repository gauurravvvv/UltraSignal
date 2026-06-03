/**
 * deleteSystemAdminBulk — soft-deletes multiple system admins in one transaction.
 *
 * All soft-deletes happen atomically: either all succeed or none do. This prevents
 * a partial-bulk-delete state where some IDs are gone and some are still active.
 *
 * Pre-flight checks (self-delete guard, default-admin guard, existence check) all
 * happen in DeleteSystemAdminBulkValidation. The validated list is passed via
 * res.locals.systemAdmins.
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

const deleteSystemAdminBulk = async (req: Request, res: Response) => {
  Logger.info(`Bulk delete super admin request`);

  const { loggedInId, systemAdmins } = res.locals;

  try {
    await AppDataSource.transaction(async (manager: EntityManager) => {
      for (const systemAdmin of systemAdmins) {
        systemAdmin.deletedBy = loggedInId;
        await manager.save(systemAdmin);
        await manager.softRemove(systemAdmin);
      }
    });

    const deletedIds: string[] = systemAdmins.map((a: any) => a.id);

    sendResponse(res, true, CODE.SUCCESS, SYSTEM_ADMIN_MSG.BULK_DELETED, {
      deletedCount: deletedIds.length,
      deletedIds,
    });
  } catch (error) {
    Logger.error(`Error in deleteSystemAdminBulk: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default deleteSystemAdminBulk;
