/**
 * AddRoleValidation — validates the role payload and guards against duplicate names.
 *
 * `selectedPermissions` requires at least one entry (`min(1)`) because a role with
 * no permissions is effectively a dead role — the user could create it but it would
 * grant nothing, leading to confusing UX and orphaned records.
 *
 * Name uniqueness is checked by (name + clientId) to allow the same role name
 * across different clients in a multi-tenant setup.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  ROLE as ROLE_MSG,
} from '../../../shared/constants/response.messages';
import { Role } from '../../../shared/db/entities/role.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { fields } from '../../../shared/utility/joi.schemas';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';
import { AppDataSource } from '../../../shared/db';

const schema = Joi.object({
  name: fields.groupName.required(),
  description: fields.description.optional().allow('', null),
  selectedPermissions: Joi.array().items(Joi.any()).min(1).required().messages({
    'array.min': 'At least one permission must be selected',
    'any.required': 'Permissions are required',
  }),
});

const AddRoleValidation = async (
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

    const { name } = value;

    const existing = await AppDataSource.getRepository(Role).findOne({
      where: { name, clientId: clientData.id },
    });
    if (existing) {
      return sendResponse(
        res,
        false,
        CODE.ALREADY_EXISTS,
        ROLE_MSG.ALREADY_EXISTS,
      );
    }

    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default AddRoleValidation;
