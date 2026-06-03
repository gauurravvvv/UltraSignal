/**
 * getGroup — returns a group with its members and database access connections.
 *
 * `databaseAccess` rows are transformed into human-readable
 * "datasource - connection" strings rather than returning raw entity objects.
 * The UI only needs names for display and this avoids sending sensitive
 * connection metadata (credentials, host) in the group detail response.
 *
 * Soft-deleted users are already excluded by the `user.deletedOn IS NULL`
 * inner join applied in GetGroupValidation — the controller can trust that
 * `group.userGroups` only contains active members.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
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
    const connections: string[] = [];

    if (group.databaseAccess && Array.isArray(group.databaseAccess)) {
      group.databaseAccess.forEach((access: any) => {
        connections.push(
          `${access.connection?.datasource?.name || ''} - ${access.connection?.name || ''}`,
        );
      });
    }

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
      connections: connections,
    };

    sendResponse(res, true, CODE.SUCCESS, GROUP_MSG.FETCHED, response);
  } catch (error) {
    Logger.error(`Error fetching group: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default getGroup;
