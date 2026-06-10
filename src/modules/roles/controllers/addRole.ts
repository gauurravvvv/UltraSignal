/**
 * addRole — creates a new custom role for a client and stores its
 * permission grants as rows in `role_permission_mapping`.
 *
 * Body shape:
 *   {
 *     name: string,
 *     description?: string,
 *     selectedPermissions?: [{ permissionId: string, level: 1|2|3 }]
 *   }
 *
 * Entries with level <= 0 are ignored (absence = NONE, no row stored).
 *
 * Role row + mapping rows commit in a single transaction so an interrupted
 * save can't leave a role with partial grants.
 *
 * `isDefault` is always 0 on creation — default roles are seeded at client
 * onboarding and can't be added through this endpoint.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import { CODE, IS_DEFAULT } from '../../../../config/config';
import { ACCESS } from '../../../shared/constants/permissions/access';
import {
  GENERIC,
  ROLE as ROLE_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { Permission } from '../../../shared/db/entities/permission.entity';
import { Role } from '../../../shared/db/entities/role.entity';
import { RolePermissionMapping } from '../../../shared/db/entities/role-permission-mapping.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

interface SelectedPermission {
  permissionId: string;
  level: number;
}

const addRole = async (req: Request, res: Response) => {
  Logger.info('Add Role request');

  const { name, description, selectedPermissions } = req.body as {
    name: string;
    description?: string;
    selectedPermissions?: SelectedPermission[];
  };
  const { loggedInId, clientData } = res.locals;

  try {
    let saved!: Role;
    await AppDataSource.manager.transaction(async (manager: EntityManager) => {
      const role = new Role();
      role.name = name;
      role.description = description || null!;
      role.clientId = clientData.id;
      role.clientName = clientData.name;
      role.isDefault = IS_DEFAULT.NO;
      role.status = 1;
      role.createdBy = loggedInId;
      saved = await manager.getRepository(Role).save(role);

      // Mandatory permissions are granted implicitly to every authenticated
      // user via resolveUserPermissions; storing explicit mapping rows for
      // them would be redundant. Look up the mandatory permission ids and
      // strip them from the input before inserting.
      const mandatoryRows = await manager
        .getRepository(Permission)
        .find({ where: { isMandatory: true }, select: ['id'] });
      const mandatoryIds = new Set(mandatoryRows.map(r => r.id));

      const wantedMappings = (selectedPermissions ?? [])
        .filter(
          p =>
            p.permissionId &&
            p.level >= ACCESS.READ &&
            p.level <= ACCESS.FULL &&
            !mandatoryIds.has(p.permissionId),
        )
        .map(p => {
          const m = new RolePermissionMapping();
          m.roleId = saved.id;
          m.permissionId = p.permissionId;
          m.level = p.level;
          m.createdBy = loggedInId;
          return m;
        });

      if (wantedMappings.length > 0) {
        await manager.getRepository(RolePermissionMapping).save(wantedMappings);
      }
    });

    sendResponse(res, true, CODE.SUCCESS, ROLE_MSG.CREATED, saved);
  } catch (error) {
    Logger.error(`Error while creating role: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default addRole;
