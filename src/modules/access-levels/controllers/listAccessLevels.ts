/**
 * listAccessLevels — returns the static catalog of permission levels.
 *
 * The role editor in the FE calls this once on load to render the
 * None / Read / Write / Full radio columns. The order is determined
 * by `sequence` so the API can reshuffle UI ordering without an FE
 * release.
 *
 * Open to any authenticated user — the catalog itself isn't sensitive.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import { GENERIC } from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { AccessLevel } from '../../../shared/db/entities/access-level.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const listAccessLevels = async (_req: Request, res: Response) => {
  Logger.info('List Access Levels request');

  try {
    const levels = await AppDataSource.getRepository(AccessLevel).find({
      where: { status: 1 },
      order: { sequence: 'ASC' },
    });
    return sendResponse(res, true, CODE.SUCCESS, 'access_level.list_fetched', {
      count: levels.length,
      levels,
    });
  } catch (error) {
    Logger.error(`Error in listAccessLevels: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default listAccessLevels;
