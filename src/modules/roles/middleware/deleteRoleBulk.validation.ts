/**
 * DeleteRoleBulkValidation — validates the batch and enforces deletion preconditions.
 *
 * The count-mismatch guard (`roles.length !== ids.length`) detects IDs that don't
 * exist or belong to a different client. Without it, a crafted request could silently
 * match fewer roles than requested, giving the admin false confidence that all
 * targeted roles were deleted.
 *
 * If any role in the batch is default or has assignments, the entire batch is
 * rejected. Partial deletes would leave the client in an inconsistent state and force
 * the admin to discover which roles failed through trial and error.
 *
 * Assignment counts are aggregated across all IDs in a single query (`In(ids)`) to
 * avoid N+1 database calls for large batches.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { In } from 'typeorm';
import { CODE, IS_DEFAULT } from '../../../../config/config';
import {
  GENERIC,
  ROLE as ROLE_MSG,
} from '../../../shared/constants/response.messages';
import { Group } from '../../../shared/db/entities/group.entity';
import { Role } from '../../../shared/db/entities/role.entity';
import { UserGroupMapping } from '../../../shared/db/entities/user-group-mapping.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { fields } from '../../../shared/utility/joi.schemas';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';
import { AppDataSource } from '../../../shared/db';

const schema = Joi.object({
  ids: Joi.array().items(fields.id).min(1).required().messages({
    'array.min': 'At least one role must be selected',
    'any.required': 'Role ids are required',
  }),
  justification: fields.justification.optional(),
});

const DeleteRoleBulkValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { clientData } = res.locals;

    const { error, value } = validateSchema(schema, req.body);
    if (error) {
      return sendResponse(res, false, CODE.BAD_REQUEST, error);
    }
    req.body = value;

    const { ids } = value;

    const roles = await AppDataSource
      .getRepository(Role)
      .find({ where: { id: In(ids), clientId: clientData.id } });

    if (roles.length !== ids.length) {
      return sendResponse(res, false, CODE.NOT_FOUND, ROLE_MSG.NOT_FOUND);
    }

    const defaultRole = roles.find((r: any) => r.isDefault === IS_DEFAULT.YES);
    if (defaultRole) {
      return sendResponse(
        res,
        false,
        CODE.UNAUTHORIZED,
        ROLE_MSG.CANNOT_MODIFY_DEFAULT,
      );
    }

    const userCount: number = await AppDataSource
      .getRepository(UserGroupMapping)
      .createQueryBuilder('m')
      .innerJoin('m.group', 'g')
      .where('g.roleId IN (:...ids)', { ids })
      .andWhere('g.clientId = :clientId', { clientId: clientData.id })
      .select('COUNT(DISTINCT m.userId)', 'count')
      .getRawOne()
      .then((r: { count: string } | undefined) => parseInt(r?.count ?? '0', 10));
    if (userCount > 0) {
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        `Selected role(s) are assigned to ${userCount} user(s) via their groups. Reassign them before deleting.`,
      );
    }

    const groupCount = await AppDataSource
      .getRepository(Group)
      .count({ where: { roleId: In(ids), clientId: clientData.id } });
    if (groupCount > 0) {
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        `Selected role(s) are assigned to ${groupCount} group(s). Delete or reassign them before deleting the role.`,
      );
    }

    res.locals.roles = roles;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default DeleteRoleBulkValidation;
