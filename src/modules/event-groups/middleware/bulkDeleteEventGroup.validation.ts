/**
 * BulkDeleteEventGroupValidation — validates batch, resolves all groups,
 * blocks default-group deletion, enforces ownership across the set.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { In } from 'typeorm';
import { CODE, IS_DEFAULT } from '../../../../config/config';
import {
  EVENT_GROUP as EG_MSG,
  GENERIC,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { EventGroup } from '../../../shared/db/entities/eventGroup.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { fields } from '../../../shared/utility/joi.schemas';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const schema = Joi.object({
  ids: Joi.array().items(fields.id).min(1).required().messages({
    'array.min': 'At least one event group must be selected',
    'any.required': 'Event group ids are required',
  }),
  justification: fields.justification.optional(),
});

const BulkDeleteEventGroupValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { clientData, loggedInId, permissions } = res.locals;
    const clientId = clientData?.id as string;

    const { error, value } = validateSchema(schema, req.body);
    if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);
    req.body = value;

    const groups = await AppDataSource.getRepository(EventGroup).find({
      where: { id: In(value.ids), clientId },
    });

    if (groups.length !== value.ids.length) {
      return sendResponse(res, false, CODE.NOT_FOUND, EG_MSG.NOT_FOUND);
    }

    if (groups.some((g: EventGroup) => g.isDefault === IS_DEFAULT.YES)) {
      return sendResponse(
        res,
        false,
        CODE.UNAUTHORIZED,
        EG_MSG.CANNOT_MODIFY_DEFAULT,
      );
    }

    const isAdmin =
      Array.isArray(permissions) &&
      permissions.some(
        (p: any) =>
          p.value === 'userManagement' ||
          (p.subPermissions || []).some(
            (sp: any) => sp.value === 'userManagement',
          ),
      );
    if (
      !isAdmin &&
      groups.some(
        (g: EventGroup) => g.createdBy && g.createdBy !== loggedInId,
      )
    ) {
      return sendResponse(res, false, CODE.UNAUTHORIZED, EG_MSG.NOT_OWNER);
    }

    res.locals.eventGroups = groups;
    next();
  } catch (error) {
    Logger.error(`bulkDeleteEventGroup validation: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default BulkDeleteEventGroupValidation;
