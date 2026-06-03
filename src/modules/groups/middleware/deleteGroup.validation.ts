/**
 * DeleteGroupValidation — resolves the group and blocks deletion if active database
 * access assignments exist.
 *
 * The group is loaded with the `databaseAccess` relation so the middleware can check
 * for active access assignments in the same query, avoiding a second DB roundtrip.
 *
 * Blocking deletion when the group has database access prevents users in the group
 * from silently losing DB access mid-session — the admin must explicitly revoke
 * access before removing the group.
 *
 * Default group guard runs first: if isDefault === 1, the access check is skipped
 * because the response is already set.
 */
import { NextFunction, Request, Response } from 'express';
import { CODE, IS_DEFAULT, VALIDATION_MESSAGES } from '../../../../config/config';
import {
  GROUP,
  CLIENT,
} from '../../../shared/constants/response.messages';
import { Group } from '../../../shared/db/entities/group.entity';
import sendResponse from '../../../shared/utility/response';
import { AppDataSource } from '../../../shared/db';

const DeleteGroupValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { id } = req.params;
  const clientId = res.locals.clientData?.id as string;

  if (!id) {
    return sendResponse(
      res,
      false,
      CODE.BAD_REQUEST,
      VALIDATION_MESSAGES.ID.REQUIRED + ' for group',
    );
  }

  if (!clientId) {
    return sendResponse(
      res,
      false,
      CODE.BAD_REQUEST,
      VALIDATION_MESSAGES.ID.REQUIRED + ' for client',
    );
  }

  // Check if group exists
  try {
    const group = await AppDataSource.getRepository(Group).findOne({
      where: { id, clientId: clientId },
      relations: ['databaseAccess'],
    });

    if (!group) {
      return sendResponse(res, false, CODE.NOT_FOUND, GROUP.NOT_FOUND);
    }

    // Prevent deletion of default groups
    if (group.isDefault === IS_DEFAULT.YES) {
      return sendResponse(
        res,
        false,
        CODE.UNAUTHORIZED,
        GROUP.CANNOT_MODIFY_DEFAULT,
      );
    }

    // Check if group has database accesses assigned
    if (group.databaseAccess && group.databaseAccess.length > 0) {
      return sendResponse(
        res,
        false,
        CODE.CONFLICT,
        'Cannot delete group with assigned database access. Please remove all assignments first',
      );
    }

    res.locals.group = group;
  } catch (err) {
    return sendResponse(res, false, CODE.BAD_REQUEST, CLIENT.INVALID_ID);
  }

  next();
};

export default DeleteGroupValidation;
