/**
 * UpdateUserValidation — enforces uniqueness constraints and optionally validates
 * group assignments before the controller applies changes.
 *
 * `Not(id)` on the email and username duplicate checks allows a no-op update
 * (submitting the same email/username the user already has) without a false
 * conflict error.
 *
 * Group IDs are optional on update (unlike add) because an admin may only want
 * to change profile fields. When provided, the same active-group count-mismatch
 * guard as addUser applies.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { Not } from 'typeorm';
import { CODE, IS_DEFAULT } from '../../../../config/config';
import {
  GENERIC,
  USER as USER_MSG,
} from '../../../shared/constants/response.messages';
import { Group } from '../../../shared/db/entities/group.entity';
import { User } from '../../../shared/db/entities/user.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { fields } from '../../../shared/utility/joi.schemas';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';
import { AppDataSource } from '../../../shared/db';

const schema = Joi.object({
  id: fields.id.required(),
  email: fields.email.required(),
  username: fields.username.required(),
  firstName: fields.firstName.required(),
  lastName: fields.lastName.required(),
  status: fields.status.optional(),
  justification: fields.justification.optional(),
  groupIds: Joi.array().items(fields.id).min(1).optional().messages({
    'array.min': 'At least one group must be selected',
  }),
});

const UpdateUserValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { orgData } = res.locals;

    const { error, value } = validateSchema(schema, req.body);
    if (error) {
      return sendResponse(res, false, CODE.BAD_REQUEST, error);
    }
    req.body = value;

    const { id, email, username } = value;

    const orgUser = await AppDataSource.getRepository(User).findOne({
      where: { id, organisationId: orgData.id },
    });

    if (!orgUser) {
      return sendResponse(res, false, CODE.NOT_FOUND, USER_MSG.NOT_FOUND);
    }

    // Default user (created during org onboarding, `username: master_admin`)
    // is fully immutable through this endpoint. No field can be changed —
    // not the name, not the email, and especially not groupIds (which
    // would silently strip Administrator permissions and lock the org out
    // of its own recovery account). Recovery / break-glass scenarios go
    // through DB migrations, not the API.
    if (orgUser.isDefault === IS_DEFAULT.YES) {
      return sendResponse(
        res,
        false,
        CODE.UNAUTHORIZED,
        USER_MSG.CANNOT_MODIFY_DEFAULT,
      );
    }

    const ifExistsByEmail = await AppDataSource
      .getRepository(User)
      .findOne({
        where: {
          id: Not(id),
          email,
          organisationId: orgData.id,
        },
      });

    if (ifExistsByEmail) {
      return sendResponse(
        res,
        false,
        CODE.ALREADY_EXISTS,
        USER_MSG.ALREADY_EXISTS_EMAIL,
      );
    }

    const ifExistsByUsername = await AppDataSource
      .getRepository(User)
      .findOne({
        where: {
          id: Not(id),
          username,
          organisationId: orgData.id,
        },
      });

    if (ifExistsByUsername) {
      return sendResponse(
        res,
        false,
        CODE.ALREADY_EXISTS,
        USER_MSG.ALREADY_EXISTS_USERNAME,
      );
    }

    const { groupIds } = value;
    if (groupIds && groupIds.length > 0) {
      const groups = await AppDataSource
        .getRepository(Group)
        .createQueryBuilder('g')
        .where('g.id IN (:...ids)', { ids: groupIds })
        .andWhere('g.organisationId = :orgId', { orgId: orgData.id })
        .andWhere('g.status = :activeStatus', { activeStatus: '1' })
        .getMany();

      if (groups.length !== groupIds.length) {
        return sendResponse(
          res,
          false,
          CODE.NOT_FOUND,
          'One or more selected groups not found or inactive',
        );
      }
    }

    res.locals.orgUser = orgUser;

    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default UpdateUserValidation;
