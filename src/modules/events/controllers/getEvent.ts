/**
 * getEvent — returns one MedDRA row.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  MEDDRA as MEDDRA_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { MeddraBrowser } from '../../../shared/db/entities/meddra.entity';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const getEvent = async (req: Request, res: Response) => {
  Logger.info(`Get MedDRA Event request`);

  const { id } = req.params;

  try {
    const event = await AppDataSource.getRepository(MeddraBrowser).findOne({
      where: { id },
    });

    if (!event) {
      return sendResponse(res, false, CODE.NOT_FOUND, MEDDRA_MSG.NOT_FOUND);
    }

    sendResponse(res, true, CODE.SUCCESS, MEDDRA_MSG.FETCHED, event);
  } catch (error) {
    Logger.error(`Error fetching event: ${error}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default getEvent;
