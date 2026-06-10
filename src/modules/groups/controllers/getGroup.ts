/**
 * getGroup — returns a group with its member list for the detail view.
 *
 * Soft-deleted users are already excluded by the `user.deletedOn IS NULL`
 * join applied in GetGroupValidation — the controller can trust that
 * `group.userGroups` only contains active members.
 */
import { Request, Response } from 'express';
import { CODE, IS_DEFAULT } from '../../../../config/config';
import {
  GENERIC,
  GROUP as GROUP_MSG,
} from '../../../shared/constants/response.messages';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const getGroup = async (req: Request, res: Response) => {
  Logger.info(`Get Group request`);

  const { group } = res.locals;

  try {
    // Default groups (Administrators / Members) are immutable — the FE
    // hides Edit / Delete via these flags.
    const isMutable = group.isDefault !== IS_DEFAULT.YES;

    const response = {
      id: group.id,
      name: group.name,
      description: group.description,
      clientId: group.clientId,
      clientName: group.clientName,
      roleId: group.roleId,
      roleName: group.roleName,
      isDefault: group.isDefault,
      status: group.status,
      createdOn: group.createdOn,
      userGroups: group.userGroups,
      canEdit: isMutable,
      canDelete: isMutable,
    };

    sendResponse(res, true, CODE.SUCCESS, GROUP_MSG.FETCHED, response);
  } catch (error) {
    Logger.error(`Error fetching group: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default getGroup;
