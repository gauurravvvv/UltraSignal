/**
 * GetEventGroupValidation — loads the event group with members + their
 * underlying MeddraBrowser data.
 */
import { NextFunction, Request, Response } from 'express';
import { CODE, VALIDATION_MESSAGES } from '../../../../config/config';
import {
  CLIENT,
  EVENT_GROUP as EG_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { EventGroup } from '../../../shared/db/entities/eventGroup.entity';
import sendResponse from '../../../shared/utility/response';

const GetEventGroupValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { id } = req.params;
  const { clientData } = res.locals;
  const clientId = clientData?.id as string;

  if (!id) {
    return sendResponse(
      res,
      false,
      CODE.BAD_REQUEST,
      VALIDATION_MESSAGES.ID.REQUIRED + ' for event group',
    );
  }

  try {
    const group = await AppDataSource.getRepository(EventGroup)
      .createQueryBuilder('eg')
      .leftJoinAndSelect('eg.members', 'm', 'm.deletedOn IS NULL')
      .leftJoinAndSelect('m.member', 'browser')
      .where('eg.id = :id', { id })
      .andWhere('eg.clientId = :clientId', { clientId })
      .getOne();

    if (!group) {
      return sendResponse(res, false, CODE.NOT_FOUND, EG_MSG.NOT_FOUND);
    }

    res.locals.eventGroup = group;
  } catch {
    return sendResponse(res, false, CODE.BAD_REQUEST, CLIENT.INVALID_ID);
  }

  next();
};

export default GetEventGroupValidation;
