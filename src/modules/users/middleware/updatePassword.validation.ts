/**
 * UpdatePasswordValidation — confirms the target user exists before exposing
 * the password-update endpoint.
 *
 * The actual password-history check and credential hashing happen in the
 * controller, not here, because they require org encryption config that is
 * cleanest to access in the controller layer after res.locals is fully
 * populated.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
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
  id: fields.id.required(),
  newPassword: fields.password.required().messages({
    'any.required': 'New password is required',
    'string.empty': 'New password is required',
  }),
});

const UpdatePasswordValidation = async (
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

    const { id } = value;

    const orgUser = await AppDataSource.getRepository(User).findOne({
      where: { id, organisationId: orgData.id },
    });

    if (!orgUser) {
      return sendResponse(res, false, CODE.NOT_FOUND, USER_MSG.NOT_FOUND);
    }

    res.locals.orgUser = orgUser;

    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default UpdatePasswordValidation;
