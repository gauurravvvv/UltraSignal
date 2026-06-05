/**
 * AddEventGroupValidation — validates payload, duplicate name, member ids.
 * MedDRA members reference the GLOBAL MeddraBrowser dictionary — no
 * clientId filter on the lookup.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { In } from 'typeorm';
import { CODE } from '../../../../config/config';
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
  name: fields.groupName.required(),
  description: fields.description.optional().allow('', null),
  sourceId: Joi.number().integer().optional(),
  status: fields.status.optional(),
  members: Joi.array().items(memberSchema).min(0).optional().default([]),
});

const AddEventGroupValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { clientData } = res.locals;
    const clientId = clientData.id;

    const { error, value } = validateSchema(schema, req.body);
    if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);
    req.body = value;

    const existing = await AppDataSource.getRepository(EventGroup).findOne({
      where: { name: value.name, clientId },
    });
    if (existing) {
      return sendResponse(
        res,
        false,
        CODE.ALREADY_EXISTS,
        EG_MSG.ALREADY_EXISTS,
      );
    }

    if (value.members?.length) {
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

    next();
  } catch (error) {
    Logger.error(`addEventGroup validation: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default AddEventGroupValidation;
