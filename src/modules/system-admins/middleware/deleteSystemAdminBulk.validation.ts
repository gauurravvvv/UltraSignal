/**
 * DeleteSystemAdminBulkValidation — validates DELETE /system-admin/delete/bulk.
 *
 * Authorisation is enforced upstream by `VerifyPermissionMiddleware('systemAdmin')`;
 * this middleware is now payload-only. Requires a non-empty `ids` array in the
 * request body. Fetches all target records in one query and verifies the returned
 * count matches the requested count — a mismatch means at least one ID is
 * invalid or doesn't belong to a system admin, which is rejected with NOT_FOUND.
 *
 * Same self-deletion and default-admin guards as the single-delete validation.
 * Pre-loads res.locals.systemAdmins (array) for the bulk delete controller.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { In } from 'typeorm';
import { SYSTEM_CLIENT, CODE, IS_DEFAULT } from '../../../../config/config';
import {
  GENERIC,
  SYSTEM_ADMIN as SYSTEM_ADMIN_MSG } from '../../../shared/constants/response.messages';
import { User } from '../../../shared/db/entities/user.entity';
import { fields } from '../../../shared/utility/joi.schemas';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const schema = Joi.object({
  ids: Joi.array().items(fields.id).min(1).required().messages({
    'array.min': 'At least one super admin must be selected',
    'any.required': 'System admin ids are required' }),
  justification: fields.justification.optional() });

const DeleteSystemAdminBulkValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { loggedInId } = res.locals;

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

    const systemAdmins = await User.find({
      where: { id: In(ids), clientName: SYSTEM_CLIENT.NAME } });

    if (systemAdmins.length !== ids.length) {
      return sendResponse(
        res,
        false,
        CODE.NOT_FOUND,
        SYSTEM_ADMIN_MSG.NOT_FOUND,
      );
    }

    const defaultAdmin = systemAdmins.find(
      (sa: any) => sa.isDefault === IS_DEFAULT.YES,
    );
    if (defaultAdmin) {
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        SYSTEM_ADMIN_MSG.CANNOT_DELETE_DEFAULT,
      );
    }

    res.locals.systemAdmins = systemAdmins;
    next();
  } catch (err: any) {
    Logger.error(`Validation error: ${err.message}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default DeleteSystemAdminBulkValidation;
