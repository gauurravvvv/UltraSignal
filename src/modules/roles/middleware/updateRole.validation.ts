/**
 * UpdateRoleValidation — resolves the role and enforces default-role immutability
 * before the controller runs.
 *
 * Default roles (isDefault === 1) are seeded by org onboarding and are immune to
 * modification via this endpoint. Blocking in middleware (not the controller) means
 * this invariant is enforced even if the controller changes.
 *
 * The `Not(id)` in the duplicate-name check excludes the current role so an admin
 * can submit the same name without triggering a false duplicate error (e.g., when
 * only updating the description or permissions).
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { Not } from 'typeorm';
import { CODE, IS_DEFAULT } from '../../../../config/config';
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
  id: fields.id.required(),
  name: fields.groupName.required(),
  description: fields.description.optional().allow('', null),
  selectedPermissions: Joi.array().items(Joi.any()).min(1).required().messages({
    'array.min': 'At least one permission must be selected',
    'any.required': 'Permissions are required',
  }),
  status: fields.status.optional(),
  justification: fields.justification.optional(),
});

const UpdateRoleValidation = async (
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

    const { id, name } = value;

    const role = await AppDataSource.getRepository(Role).findOne({
      where: { id, organisationId: orgData.id },
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

    // Duplicate name check (excluding current role)
    const existing = await AppDataSource.getRepository(Role).findOne({
      where: { id: Not(id), name, organisationId: orgData.id },
    });
    if (existing) {
      return sendResponse(
        res,
        false,
        CODE.ALREADY_EXISTS,
        ROLE_MSG.ALREADY_EXISTS,
      );
    }

    res.locals.role = role;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default UpdateRoleValidation;
