/**
 * UpdateEventGroupValidation — enforces ownership, frozen default groups,
 * uniqueness of name within tenant, and validity of MedDRA member ids.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { In, Not } from 'typeorm';
import { CODE, IS_DEFAULT } from '../../../../config/config';
import {
  EVENT_GROUP as EG_MSG,
  GENERIC,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { EventGroup } from '../../../shared/db/entities/eventGroup.entity';
import { MeddraBrowser } from '../../../shared/db/entities/meddra.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { fields } from '../../../shared/utility/joi.schemas';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const memberSchema = Joi.object({
  memberId: fields.id.required(),
  level: Joi.string()
    .trim()
    .uppercase()
    .valid('SOC', 'HLGT', 'HLT', 'PT', 'LLT', 'SMQ')
    .optional(),
  language: Joi.string().trim().lowercase().max(10).optional(),
  sourceId: Joi.number().integer().optional(),
});

const schema = Joi.object({
  id: fields.id.required(),
  name: fields.groupName.required(),
  description: fields.description.optional().allow('', null),
  sourceId: Joi.number().integer().optional(),
  status: fields.status.optional(),
  members: Joi.array().items(memberSchema).min(0).required().messages({
    'array.base': 'Members must be an array',
    'any.required': 'Members are required',
  }),
});

const UpdateEventGroupValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { clientData, loggedInId, permissions } = res.locals;
    const clientId = clientData.id;

    const { error, value } = validateSchema(schema, req.body);
    if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);
    req.body = value;

    const group = await AppDataSource.getRepository(EventGroup).findOne({
      where: { id: value.id, clientId },
    });
    if (!group) {
      return sendResponse(res, false, CODE.NOT_FOUND, EG_MSG.NOT_FOUND);
    }

    if (group.isDefault === IS_DEFAULT.YES) {
      if (
        value.name !== group.name ||
        (value.description || '') !== (group.description || '') ||
        (value.status !== undefined && value.status !== group.status)
      ) {
        return sendResponse(
          res,
          false,
          CODE.UNAUTHORIZED,
          EG_MSG.CANNOT_MODIFY_DEFAULT,
        );
      }
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
    if (group.createdBy && group.createdBy !== loggedInId && !isAdmin) {
      return sendResponse(res, false, CODE.UNAUTHORIZED, EG_MSG.NOT_OWNER);
    }

    const dup = await AppDataSource.getRepository(EventGroup).findOne({
      where: { id: Not(value.id), name: value.name, clientId },
    });
    if (dup) {
      return sendResponse(
        res,
        false,
        CODE.ALREADY_EXISTS,
        EG_MSG.ALREADY_EXISTS,
      );
    }

    if (value.members.length > 0) {
      const memberIds = value.members.map((m: { memberId: string }) => m.memberId);
      const found = await AppDataSource.getRepository(MeddraBrowser).find({
        where: { id: In(memberIds) },
        select: ['id'],
      });
      if (found.length !== memberIds.length) {
        return sendResponse(
          res,
          false,
          CODE.BAD_REQUEST,
          EG_MSG.MEMBERS_NOT_FOUND,
        );
      }
    }

    res.locals.eventGroup = group;
    next();
  } catch (error) {
    Logger.error(`updateEventGroup validation: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default UpdateEventGroupValidation;
