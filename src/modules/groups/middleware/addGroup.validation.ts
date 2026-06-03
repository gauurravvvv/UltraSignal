/**
 * AddGroupValidation — validates the payload and guards against duplicate names
 * and cross-client user references.
 *
 * User membership validation (`foundUsers.length !== value.users.length`) uses a
 * count-mismatch pattern to detect IDs that don't exist or belong to a different
 * client without exposing which IDs failed. This prevents an admin from probing for
 * valid user UUIDs across client boundaries.
 *
 * `users` defaults to an empty array so the controller doesn't need a null check
 * before iterating over members — a group with no members at creation is valid.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { In } from 'typeorm';
import { CODE, IS_DEFAULT } from '../../../../config/config';
import {
  GENERIC,
  GROUP as GROUP_MSG,
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
  name: fields.groupName.required(),
  description: fields.description.optional().allow('', null),
  roleId: fields.id.required(),
  status: fields.status.optional(),
  users: Joi.array().items(Joi.string().trim()).min(0).optional().default([]),
});

const AddGroupValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { clientData } = res.locals;
    const clientId = clientData.id;

    const { error, value } = validateSchema(schema, req.body);
    if (error) {
      return sendResponse(res, false, CODE.BAD_REQUEST, error);
    }
    req.body = value;

    // Check if group with same name already exists in the client.
    // `clientId` is sourced from res.locals — req.body has been stripped of
    // any client-supplied client key by SanitizeClientInputMiddleware.
    const ifExistsByName = await AppDataSource
      .getRepository(Group)
      .findOne({
        where: { name: value.name, clientId: clientId },
      });
    if (ifExistsByName) {
      return sendResponse(
        res,
        false,
        CODE.ALREADY_EXISTS,
        GROUP_MSG.ALREADY_EXISTS,
      );
    }

    // Validate all users exist in the client. Also pull
    // `isDefault` so we can reject any attempt to seed a brand-new
    // group with the bootstrap admin (isDefault=1) — the default user
    // belongs only to its seeded default group; see
    // updateGroup.validation.ts for the same invariant on updates.
    if (value.users?.length) {
      const foundUsers = await AppDataSource.getRepository(User).find({
        where: {
          id: In(value.users),
          clientId: clientId,
        },
        select: ['id', 'isDefault'],
      });

      if (foundUsers.length !== value.users.length) {
        return sendResponse(
          res,
          false,
          CODE.BAD_REQUEST,
          'One or more users not found in this client',
        );
      }

      if (foundUsers.some((u: User) => u.isDefault === IS_DEFAULT.YES)) {
        return sendResponse(
          res,
          false,
          CODE.UNAUTHORIZED,
          GROUP_MSG.CANNOT_INCLUDE_DEFAULT_USER,
        );
      }
    }

    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default AddGroupValidation;
