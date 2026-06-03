/**
 * DeleteRoleValidation — guards against deleting a role that is still in use.
 *
 * Default roles cannot be deleted because they are required for the client to function
 * (e.g., a base admin or user role that the system creates on onboarding).
 *
 * Active user and group assignments must be cleared first because deleting an
 * assigned role would leave users/groups with a dangling roleId and undefined
 * permission state — the system has no fallback role to apply in that case.
 * Surfacing the count in the error message helps the admin understand the scope of
 * reassignment work before proceeding.
 */
import { NextFunction, Request, Response } from 'express';
import { CODE, IS_DEFAULT } from '../../../../config/config';
import {
  GENERIC,
  ROLE as ROLE_MSG,
} from '../../../shared/constants/response.messages';
import { Group } from '../../../shared/db/entities/group.entity';
import { Role } from '../../../shared/db/entities/role.entity';
import { UserGroupMapping } from '../../../shared/db/entities/user-group-mapping.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { AppDataSource } from '../../../shared/db';

const DeleteRoleValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { clientData } = res.locals;
    const { id } = req.params;

    const role = await AppDataSource.getRepository(Role).findOne({
      where: { id, clientId: clientData.id },
    });
    if (!role) {
      return sendResponse(res, false, CODE.NOT_FOUND, ROLE_MSG.NOT_FOUND);
    }
    if (role.isDefault === IS_DEFAULT.YES) {
      return sendResponse(
        res,
        false,
        CODE.UNAUTHORIZED,
        ROLE_MSG.CANNOT_MODIFY_DEFAULT,
      );
    }

    // Per-client users carry roles via group membership only (no direct
    // `roleId` column on User). Count distinct users currently in any
    // group that references this role.
    const userCount: number = await AppDataSource
      .getRepository(UserGroupMapping)
      .createQueryBuilder('m')
      .innerJoin('m.group', 'g')
      .where('g.roleId = :id', { id })
      .andWhere('g.clientId = :clientId', { clientId: clientData.id })
      .select('COUNT(DISTINCT m.userId)', 'count')
      .getRawOne()
      .then((r: { count: string } | undefined) => parseInt(r?.count ?? '0', 10));
    if (userCount > 0) {
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        `Role is assigned to ${userCount} user(s) via their groups. Reassign them before deleting.`,
      );
    }

    // Block delete if assigned to any group
    const groupCount = await AppDataSource
      .getRepository(Group)
      .count({ where: { roleId: id, clientId: clientData.id } });
    if (groupCount > 0) {
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        `Role is assigned to ${groupCount} group(s). Delete or reassign them before deleting the role.`,
      );
    }

    res.locals.role = role;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default DeleteRoleValidation;
