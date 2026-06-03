/**
 * getRole — returns a single role pre-fetched by GetRoleValidation middleware.
 *
 * The role is already validated (exists + belongs to org) before this controller
 * runs. The controller only needs to return it — all the DB work happened in the
 * middleware to keep the pre-load pattern consistent with other GET endpoints.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  ROLE as ROLE_MSG,
} from '../../../shared/constants/response.messages';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const getRole = async (req: Request, res: Response) => {
  Logger.info('Get Role request');

  const { role } = res.locals;

  try {
    sendResponse(res, true, CODE.SUCCESS, ROLE_MSG.FETCHED, role);
  } catch (error) {
    Logger.error(`Error while fetching role: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default getRole;
