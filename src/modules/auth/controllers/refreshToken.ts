/**
 * refreshToken — issues a new short-lived access token using the opaque refresh token.
 *
 * The refresh token is matched against the DB record (not decoded — it's an opaque
 * random string). This also re-resolves the user's latest permissions so role
 * changes or group membership updates take effect without requiring a full logout.
 * The refresh token itself is NOT rotated here to avoid breaking concurrent tabs.
 */
import { Request, Response } from 'express';
import { ACCESS_TOKEN_EXPIRY, CODE } from '../../../../config/config';
import {
  AUTH as AUTH_MSG,
  GENERIC,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { Client } from '../../../shared/db/entities/client.entity';
import { User } from '../../../shared/db/entities/user.entity';
import { createToken } from '../../../shared/utility/jwt';
import Logger from '../../../shared/utility/logger/logger';
import { resolveUserPermissions } from '../../../shared/utility/resolveUserPermissions';
import sendResponse from '../../../shared/utility/response';

const refreshToken = async (req: Request, res: Response) => {
  Logger.info(`Refresh token request`);

  const { refreshToken: refreshTokenInput, client: clientNameInput } = req.body;

  if (!refreshTokenInput || !clientNameInput) {
    return sendResponse(res, false, CODE.BAD_REQUEST, GENERIC.BAD_REQUEST);
  }

  try {
    const client = await Client.findOne({
      where: { name: clientNameInput },
      relations: ['config'],
    });

    if (!client) {
      return sendResponse(
        res,
        false,
        CODE.UNAUTHORIZED,
        AUTH_MSG.REFRESH_TOKEN_INVALID,
      );
    }

    const user = await AppDataSource.getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.refreshToken')
      .addSelect('user.refreshTokenExpiresAt')
      .where('user.refreshToken = :token', { token: refreshTokenInput })
      .andWhere('user.clientName = :client', { client: clientNameInput })
      .getOne();

    if (!user) {
      return sendResponse(
        res,
        false,
        CODE.UNAUTHORIZED,
        AUTH_MSG.REFRESH_TOKEN_INVALID,
      );
    }

    if (!user.refreshTokenExpiresAt || new Date() > user.refreshTokenExpiresAt) {
      user.refreshToken = null;
      user.refreshTokenExpiresAt = null;
      await AppDataSource.getRepository(User).save(user);
      return sendResponse(
        res,
        false,
        CODE.UNAUTHORIZED,
        AUTH_MSG.SESSION_EXPIRED,
      );
    }

    if (user.status !== 1) {
      return sendResponse(
        res,
        false,
        CODE.UNAUTHORIZED,
        AUTH_MSG.REFRESH_TOKEN_INVALID,
      );
    }

    const resolved = await resolveUserPermissions(AppDataSource, user.id);
    const permissions = resolved.permissions;
    const tokenRole = resolved.roleName;

    const tokenObject = {
      id: user.id,
      name: `${user.firstName} ${user.lastName ?? ''}`,
      email: user.email,
      username: user.username,
      isFirstLogin: user.isFirstLogin,
      role: tokenRole,
      clientId: user.clientId,
      clientName: user.clientName,
      permissions,
      locale: user.locale || 'en',
    };

    const newAccessToken = createToken(tokenObject, ACCESS_TOKEN_EXPIRY);

    Logger.info(`Access token refreshed for user: ${user.username}`);

    sendResponse(res, true, CODE.SUCCESS, AUTH_MSG.REFRESH_TOKEN_SUCCESS, {
      accessToken: newAccessToken,
    });
  } catch (error) {
    Logger.error('Error occurred during token refresh:', error.stack || error);
    sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default refreshToken;
