/**
 * DeleteUserBulkValidation — validates the batch and enforces self-deletion and
 * default-user guards across all users at once.
 *
 * Self-deletion is checked against the `ids` array before the DB query so a
 * short-circuit response avoids a DB fetch for a request that would always
 * be rejected.
 *
 * The count-mismatch guard (`users.length !== ids.length`) detects IDs that
 * don't exist or belong to a different org, consistent with the single-delete
 * pattern.
 *
 * Both protections apply to every caller. The previous SYSTEM-ADMIN bypass
 * is gone; system admins can't reach this route under the V2 permission set.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { In } from 'typeorm';
import { CODE, IS_DEFAULT } from '../../../../config/config';
import {
  GENERIC,
  USER as USER_MSG,
} from '../../../shared/constants/response.messages';
import { User } from '../../../shared/db/entities/user.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { fields } from '../../../shared/utility/joi.schemas';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';
import { AppDataSource } from '../../../shared/db';

const schema = Joi.object({
  ids: Joi.array().items(fields.id).min(1).required().messages({
    'array.min': 'At least one user must be selected',
    'any.required': 'User ids are required',
  }),
  justification: fields.justification.optional(),
});

const DeleteUserBulkValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { loggedInId, orgData } = res.locals;

    const { error, value } = validateSchema(schema, req.body);
    if (error) {
      return sendResponse(res, false, CODE.BAD_REQUEST, error);
    }
    req.body = value;

    const { ids } = value;

    if (ids.includes(loggedInId)) {
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        'You cannot delete yourself',
      );
    }

    const users = await AppDataSource
      .getRepository(User)
      .find({ where: { id: In(ids), organisationId: orgData.id } });

    if (users.length !== ids.length) {
      return sendResponse(res, false, CODE.NOT_FOUND, USER_MSG.NOT_FOUND);
    }

    const defaultUser = users.find((u: any) => u.isDefault === IS_DEFAULT.YES);
    if (defaultUser) {
      return sendResponse(
        res,
        false,
        CODE.UNAUTHORIZED,
        USER_MSG.CANNOT_DELETE_DEFAULT,
      );
    }

    res.locals.orgUsers = users;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default DeleteUserBulkValidation;
