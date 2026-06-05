/**
 * getEventGroup — returns one event group with its MedDRA members.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  EVENT_GROUP as EG_MSG,
  GENERIC,
} from '../../../shared/constants/response.messages';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const getEventGroup = async (req: Request, res: Response) => {
  Logger.info(`Get Event Group request`);

  const { eventGroup } = res.locals;

  try {
    sendResponse(res, true, CODE.SUCCESS, EG_MSG.FETCHED, eventGroup);
  } catch (error) {
    Logger.error(`Error fetching event group: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default getEventGroup;
