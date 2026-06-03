/**
 * deleteRoleBulk — soft-deletes multiple roles in a single transaction.
 *
 * All roles are deleted in one transaction so the operation is all-or-nothing —
 * a partial delete would leave the org in an inconsistent state that's hard to
 * diagnose (some roles gone, some not, with no clear boundary).
 *
 * The middleware validates that no role in the batch is default or has active
 * assignments before this controller runs.
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

const deleteRoleBulk = async (req: Request, res: Response) => {
  Logger.info('Bulk delete Role request');

  const { loggedInId, roles } = res.locals;

  try {
    await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        for (const role of roles) {
          role.deletedBy = loggedInId;
          await manager.getRepository(Role).save(role);
          await manager.getRepository(Role).softDelete(role.id);
        }
      },
    );

    const deletedIds: string[] = roles.map((r: Role) => r.id);

    sendResponse(res, true, CODE.SUCCESS, ROLE_MSG.BULK_DELETED, {
      deletedCount: deletedIds.length,
      deletedIds,
    });
  } catch (error) {
    Logger.error(`Error while bulk deleting roles: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default deleteRoleBulk;
