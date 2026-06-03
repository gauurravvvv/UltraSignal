/**
 * GetGroupValidation — loads the group with all relations required for the detail view.
 *
 * A QueryBuilder with explicit `user.deletedOn IS NULL` and `connection.deletedOn IS NULL`
 * joins is used instead of `findOne + relations` because TypeORM's soft-delete filter
 * only applies to the root entity — it does not propagate to eagerly-loaded nested
 * relations. A plain `findOne` with `relations` would return soft-deleted users and
 * connections inside the group.
 *
 * The role name is fetched in a separate query (rather than joining in the QB) because
 * Role is in the same schema but not directly mapped as a TypeORM relation on Group.
 */
import { NextFunction, Request, Response } from 'express';
import { CODE, VALIDATION_MESSAGES } from '../../../../config/config';
import {
  GROUP,
  CLIENT,
} from '../../../shared/constants/response.messages';
import { Group } from '../../../shared/db/entities/group.entity';
import { Role } from '../../../shared/db/entities/role.entity';
import sendResponse from '../../../shared/utility/response';
import { AppDataSource } from '../../../shared/db';

const GetGroupValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { clientData } = res.locals;

  const { id } = req.params;
  const clientId = clientData?.id as string;

  if (!id) {
    return sendResponse(
      res,
      false,
      CODE.BAD_REQUEST,
      VALIDATION_MESSAGES.ID.REQUIRED + ' for group',
    );
  }

  // Check if group exists and load relations
  // Using QueryBuilder with innerJoin on user to exclude soft-deleted users
  // (TypeORM's findOne + relations doesn't reliably filter soft-deleted nested relations)
  try {
    const group: any = await AppDataSource
      .getRepository(Group)
      .createQueryBuilder('group')
      .leftJoinAndSelect('group.userGroups', 'userGroups')
      .leftJoinAndSelect('userGroups.user', 'user', 'user.deletedOn IS NULL')
      .leftJoinAndSelect('group.databaseAccess', 'databaseAccess')
      .leftJoinAndSelect(
        'databaseAccess.connection',
        'connection',
        'connection.deletedOn IS NULL',
      )
      .leftJoinAndSelect(
        'connection.datasource',
        'datasource',
        'datasource.deletedOn IS NULL',
      )
      .where('group.id = :id', { id })
      .andWhere('group.clientId = :clientId', { clientId })
      .getOne();

    if (!group) {
      return sendResponse(res, false, CODE.NOT_FOUND, GROUP.NOT_FOUND);
    }

    if (group.roleId) {
      const role = await AppDataSource
        .getRepository(Role)
        .findOne({ where: { id: group.roleId }, select: ['id', 'name'] });
      group.roleName = role?.name || null;
    }

    res.locals.group = group;
  } catch (err) {
    return sendResponse(res, false, CODE.BAD_REQUEST, CLIENT.INVALID_ID);
  }

  next();
};

export default GetGroupValidation;
