/**
 * getSession — phase 2 of the two-phase login.
 *
 * Endpoint: GET /api/v1/auth/session
 * Auth: AuthMiddleware (JWT in x-auth-token).
 *
 * Loads the authenticated user + their client (from res.locals
 * populated by AuthMiddleware) and ships back the full session
 * bootstrap payload (permissions, role, inactivity timeout, plus
 * placeholders for theme / branding / announcements).
 *
 * Returns 440 (SESSION_EXPIRED) if the user or client row is gone —
 * the JWT was valid at signing time but the data is no longer
 * available, so the FE should bounce back to /login rather than
 * retry.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  AUTH as AUTH_MSG,
  GENERIC,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { Client } from '../../../shared/db/entities/client.entity';
import { User } from '../../../shared/db/entities/user.entity';
import { buildSessionBootstrap } from '../../../shared/helpers/auth/buildSessionBootstrap';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const getSession = async (req: Request, res: Response) => {
  Logger.info('Session bootstrap (phase 2) request');

  const { loggedInId, clientId } = res.locals;

  try {
    const client = await Client.findOne({
      where: { id: clientId },
      relations: ['config'],
    });

    if (!client) {
      Logger.warn(
        `getSession: client ${clientId} not found for user ${loggedInId}`,
      );
      return sendResponse(
        res,
        false,
        CODE.SESSION_EXPIRED,
        AUTH_MSG.SESSION_EXPIRED,
      );
    }

    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: loggedInId, clientId: client.id },
    });

    if (!user) {
      Logger.warn(
        `getSession: user ${loggedInId} not found in client ${clientId}`,
      );
      return sendResponse(
        res,
        false,
        CODE.SESSION_EXPIRED,
        AUTH_MSG.SESSION_EXPIRED,
      );
    }

    const bootstrap = await buildSessionBootstrap(user, client);
    return sendResponse(res, true, CODE.SUCCESS, AUTH_MSG.LOGIN_SUCCESS, bootstrap);
  } catch (error) {
    Logger.error(`Error in getSession: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default getSession;
