/**
 * DeleteGroupBulkValidation — validates the batch and enforces deletion preconditions
 * across all groups at once.
 *
 * The `databaseAccess` relation is loaded in the batch find to check for active
 * assignments without extra queries. If any group in the batch has assignments or
 * is a default group, the entire batch is rejected — partial deletes would leave
 * the admin unable to determine which groups failed.
 *
 * The count-mismatch guard (`groups.length !== ids.length`) detects IDs that don't
 * exist or belong to a different client, consistent with the single-delete pattern.
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
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { fields } from '../../../shared/utility/joi.schemas';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';
import { AppDataSource } from '../../../shared/db';

const schema = Joi.object({
  ids: Joi.array().items(fields.id).min(1).required().messages({
    'array.min': 'At least one group must be selected',
    'any.required': 'Group ids are required',
  }),
  justification: fields.justification.optional(),
});

const DeleteGroupBulkValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const clientId = res.locals.clientData?.id as string;

    const { error, value } = validateSchema(schema, req.body);
    if (error) {
      return sendResponse(res, false, CODE.BAD_REQUEST, error);
    }
    req.body = value;

    const { ids } = value;

    const groups = await AppDataSource.getRepository(Group).find({
      where: { id: In(ids), clientId: clientId },
      relations: ['databaseAccess'],
    });

    if (groups.length !== ids.length) {
      return sendResponse(res, false, CODE.NOT_FOUND, GROUP_MSG.NOT_FOUND);
    }

    // Prevent deletion of default groups
    const defaultGroup = groups.find((g: any) => g.isDefault === IS_DEFAULT.YES);
    if (defaultGroup) {
      return sendResponse(
        res,
        false,
        CODE.UNAUTHORIZED,
        GROUP_MSG.CANNOT_MODIFY_DEFAULT,
      );
    }

    const blocked = groups.find(
      (g: any) => g.databaseAccess && g.databaseAccess.length > 0,
    );
    if (blocked) {
      return sendResponse(
        res,
        false,
        CODE.CONFLICT,
        'Cannot delete group(s) with assigned database access. Please remove all assignments first',
      );
    }

    res.locals.groups = groups;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default DeleteGroupBulkValidation;
