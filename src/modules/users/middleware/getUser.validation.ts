/**
 * GetUserValidation — loads the user and attaches their current group memberships
 * for the detail and unlock views.
 *
 * Group IDs and names are joined here rather than in the controller so that
 * both GET /get and PUT /unlock share the same pre-loaded `orgUser` shape —
 * the controller for unlock does not need to re-query membership.
 *
 * UserGroupMapping rows are not soft-deleted (hard-delete on unassign), so no
 * deletedOn filter is needed on the join.
 */
import { NextFunction, Request, Response } from 'express';
import { CODE, VALIDATION_MESSAGES } from '../../../../config/config';
import {
  ORGANISATION,
  USER as USER_MSG,
} from '../../../shared/constants/response.messages';
import { UserGroupMapping } from '../../../shared/db/entities/user-group-mapping.entity';
import { User } from '../../../shared/db/entities/user.entity';
import sendResponse from '../../../shared/utility/response';
import { AppDataSource } from '../../../shared/db';

const GetUserValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { orgData } = res.locals;
  const { id } = req.params;

  if (!id) {
    return sendResponse(
      res,
      false,
      CODE.BAD_REQUEST,
      VALIDATION_MESSAGES.ID.REQUIRED,
    );
  }

  // User existence check
  try {
    const orgUser = await AppDataSource.getRepository(User).findOne({
      where: { id, organisationId: orgData.id },
    });

    if (!orgUser) {
      return sendResponse(res, false, CODE.NOT_FOUND, USER_MSG.NOT_FOUND);
    }

    const userMappings = await AppDataSource
      .getRepository(UserGroupMapping)
      .createQueryBuilder('m')
      .innerJoinAndSelect('m.group', 'g')
      .where('m.userId = :userId', { userId: orgUser.id })
      .getMany();

    const userGroupIds = userMappings.map((m: any) => m.groupId);
    const userGroupNames = userMappings.map((m: any) => m.group.name);

    res.locals.orgUser = {
      ...orgUser,
      groupIds: userGroupIds,
      groupNames: userGroupNames,
    };
  } catch (err) {
    return sendResponse(res, false, CODE.BAD_REQUEST, ORGANISATION.INVALID_ID);
  }

  next();
};

export default GetUserValidation;
