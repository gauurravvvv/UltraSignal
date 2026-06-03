/**
 * updateSystemAdmin — partial update of a system admin's profile and status.
 *
 * Status is always replaced from the request; all other fields fall back to
 * existing values if not provided. This means the client can send a full object
 * or just the fields it wants to change.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  SYSTEM_ADMIN as SYSTEM_ADMIN_MSG,
} from '../../../shared/constants/response.messages';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const updateSystemAdmin = async (req: Request, res: Response) => {
  Logger.info(`Update System Admin request`);

  const { firstName, username, lastName, status, email } = req.body;
  const { loggedInId, systemAdmin } = res.locals;

  try {
    systemAdmin.username = username ? username : systemAdmin.username;
    systemAdmin.firstName = firstName ? firstName : systemAdmin.firstName;
    systemAdmin.lastName = lastName ? lastName : systemAdmin.lastName;
    systemAdmin.email = email ? email : systemAdmin.email;
    systemAdmin.status = status;
    systemAdmin.updatedBy = loggedInId;

    const result = await systemAdmin.save();

    sendResponse(res, true, CODE.SUCCESS, SYSTEM_ADMIN_MSG.UPDATED, result);
  } catch (error) {
    Logger.error(`Error in updateSystemAdmin: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default updateSystemAdmin;
