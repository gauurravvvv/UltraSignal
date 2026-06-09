/**
 * updateRole — applies partial updates to a role.
 *
 * If `selectedPermissions` is supplied, the existing mapping rows for this
 * role are deleted and the new set is inserted. Wholesale replace (rather
 * than diff-patch) because the UI sends the complete desired set. The
 * delete + insert runs in a single transaction so the role is never
 * temporarily empty.
 *
 * If `selectedPermissions` is omitted, only the metadata fields update —
 * mappings stay untouched.
 *
 * Default-role guard runs in middleware; by the time this controller
 * runs, `res.locals.role` is non-default and client-scoped.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import { CODE } from '../../../../config/config';
import { ACCESS } from '../../../shared/constants/permissions/access';
import {
  GENERIC,
  ROLE as ROLE_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { Role } from '../../../shared/db/entities/role.entity';
import { RolePermissionMapping } from '../../../shared/db/entities/role-permission-mapping.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

interface SelectedPermission {
  permissionId: string;
  level: number;
}

const updateRole = async (req: Request, res: Response) => {
  Logger.info('Update Role request');

  const { name, description, selectedPermissions, status } = req.body as {
    name?: string;
    description?: string;
    selectedPermissions?: SelectedPermission[];
    status?: number;
  };
  const { loggedInId, role } = res.locals;

  try {
    let saved!: Role;
    await AppDataSource.manager.transaction(async (manager: EntityManager) => {
      role.name = name ?? role.name;
      role.description =
        description !== undefined ? description : role.description;
      role.status = status !== undefined ? status : role.status;
      role.updatedBy = loggedInId;
      saved = await manager.getRepository(Role).save(role);

      if (selectedPermissions !== undefined) {
        // Wholesale replace — delete existing mappings for this role,
        // insert the new set.
        await manager
          .getRepository(RolePermissionMapping)
          .delete({ roleId: role.id });

        const wantedMappings = selectedPermissions
          .filter(
            p =>
              p.permissionId &&
              p.level >= ACCESS.READ &&
              p.level <= ACCESS.FULL,
          )
          .map(p => {
            const m = new RolePermissionMapping();
            m.roleId = role.id;
            m.permissionId = p.permissionId;
            m.level = p.level;
            m.createdBy = loggedInId;
            return m;
          });

        if (wantedMappings.length > 0) {
          await manager
            .getRepository(RolePermissionMapping)
            .save(wantedMappings);
        }
      }
    });

    sendResponse(res, true, CODE.SUCCESS, ROLE_MSG.UPDATED, saved);
  } catch (error) {
    Logger.error(`Error while updating role: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default updateRole;
