/**
 * GetGroupValidation — loads the group with its member list for the detail view.
 *
 * A QueryBuilder with an explicit `user.deletedOn IS NULL` join is used instead
 * of `findOne + relations` because TypeORM's soft-delete filter only applies to
 * the root entity — it doesn't propagate to eagerly-loaded nested relations,
 * so soft-deleted users would otherwise appear in `group.userGroups`.
 *
 * The role name is fetched in a separate query (rather than joining in the QB)
 * because Role is in the same schema but not directly mapped as a TypeORM
 * relation on Group.
 */
import { NextFunction, Request, Response } from 'express';
import { CODE, VALIDATION_MESSAGES } from '../../../../config/config';
import { GROUP, CLIENT } from '../../../shared/constants/response.messages';
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

  // Load group + members. Soft-deleted users are filtered via the join
  // condition (TypeORM's @DeleteDateColumn auto-filter doesn't propagate
  // to eagerly-loaded nested relations).
  try {
    const group: any = await AppDataSource.getRepository(Group)
      .createQueryBuilder('group')
      .leftJoinAndSelect('group.userGroups', 'userGroups')
      .leftJoinAndSelect('userGroups.user', 'user', 'user.deletedOn IS NULL')
      .where('group.id = :id', { id })
      .andWhere('group.clientId = :clientId', { clientId })
      .getOne();

    if (!group) {
      return sendResponse(res, false, CODE.NOT_FOUND, GROUP.NOT_FOUND);
    }

    if (group.roleId) {
      const role = await AppDataSource.getRepository(Role).findOne({
        where: { id: group.roleId },
        select: ['id', 'name'],
      });
      group.roleName = role?.name || null;
    }

    res.locals.group = group;
  } catch (err) {
    return sendResponse(res, false, CODE.BAD_REQUEST, CLIENT.INVALID_ID);
  }

  next();
};

export default GetGroupValidation;
