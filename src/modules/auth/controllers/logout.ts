/**
 * logout — invalidates the current session by nulling the refresh token in DB.
 *
 * After logout the access token technically remains valid until it expires
 * (JWT is stateless), but the refresh token is gone so the session cannot
 * be extended. The frontend must discard the access token immediately.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  AUTH as AUTH_MSG,
  GENERIC,
  CLIENT as CLIENT_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { Client } from '../../../shared/db/entities/client.entity';
import { User } from '../../../shared/db/entities/user.entity';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const logout = async (req: Request, res: Response) => {
  Logger.info(`Logout request`);

  const userId = res.locals.loggedInId;
  const clientName = res.locals.clientName;

  if (!userId || !clientName) {
    return sendResponse(res, false, CODE.BAD_REQUEST, GENERIC.BAD_REQUEST);
  }

  try {
    const client = await Client.findOne({
      where: { name: clientName },
      relations: ['config'],
    });

    if (!client) {
      return sendResponse(
        res,
        false,
        CODE.NOT_FOUND,
        CLIENT_MSG.NOT_FOUND,
      );
    }

    await AppDataSource.getRepository(User).update(
      { id: userId, clientName },
      { refreshToken: null as any, refreshTokenExpiresAt: null as any },
    );

    Logger.info(`User ${userId} logged out successfully`);
    sendResponse(res, true, CODE.SUCCESS, AUTH_MSG.LOGOUT_SUCCESS);
  } catch (error) {
    Logger.error('Error occurred during logout:', error.stack || error);
    sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default logout;
