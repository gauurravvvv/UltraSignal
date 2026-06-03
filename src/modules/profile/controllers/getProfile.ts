/**
 * getProfile — returns the profile of the currently authenticated user.
 *
 * All users live in the single AppDataSource. Permissions resolve via
 * UserGroupMapping → Group → Role for everyone, including system admins.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  PROFILE as PROFILE_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { Client } from '../../../shared/db/entities/client.entity';
import { User } from '../../../shared/db/entities/user.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import { resolveUserPermissions } from '../../../shared/utility/resolveUserPermissions';
import sendResponse from '../../../shared/utility/response';

const getProfile = async (req: Request, res: Response) => {
  Logger.info('Get profile request');

  const { loggedInId, clientId } = res.locals;

  try {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: loggedInId },
    });

    if (!user) {
      return sendResponse(res, false, CODE.NOT_FOUND, 'User not found');
    }

    const resolved = await resolveUserPermissions(AppDataSource, user.id);
    const roleName = resolved.roleName;
    const groupNames = resolved.groupNames;

    const profile: any = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      username: user.username,
      role: roleName,
      groupNames,
      status: user.status,
      lastLogin: user.lastLogin,
      createdOn: user.createdOn,
      isLocked: !!user.accountLockedAt,
      clientName: user.clientName,
      clientId: user.clientId,
      locale: user.locale || 'en',
    };

    if (clientId) {
      const client = await Client.findOne({ where: { id: clientId } });
      if (client) {
        profile.client = {
          id: client.id,
          name: client.name,
          description: client.description,
          status: client.status,
          createdOn: client.createdOn,
        };
      }
    }

    sendResponse(res, true, CODE.SUCCESS, PROFILE_MSG.FETCHED, profile);
  } catch (error) {
    Logger.error(`Error fetching profile: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default getProfile;
