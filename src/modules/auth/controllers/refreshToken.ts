/**
 * refreshToken — issues a new short-lived access token using the opaque refresh token.
 *
 * The refresh token is a 32-byte random hex string — globally unique — so it
 * identifies the user on its own. No client identifier is taken from the
 * request body; `user.clientId` / `user.clientName` are read off the matched
 * row and stamped into the new JWT. This re-resolves permissions on every
 * refresh so role / group changes take effect without a full logout. The
 * refresh token itself is NOT rotated here to avoid breaking concurrent tabs.
 */
import { Request, Response } from 'express';
import { ACCESS_TOKEN_EXPIRY, CODE } from '../../../../config/config';
import {
  AUTH as AUTH_MSG,
  GENERIC,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { User } from '../../../shared/db/entities/user.entity';
import { createToken } from '../../../shared/utility/jwt';
import Logger from '../../../shared/utility/logger/logger';
import { resolveUserPermissions } from '../../../shared/utility/resolveUserPermissions';
import sendResponse from '../../../shared/utility/response';

const refreshToken = async (req: Request, res: Response) => {
  Logger.info(`Refresh token request`);

  const { refreshToken: refreshTokenInput } = req.body;

  if (!refreshTokenInput) {
    return sendResponse(res, false, CODE.BAD_REQUEST, GENERIC.BAD_REQUEST);
  }

  try {
    const user = await AppDataSource.getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.refreshToken')
      .addSelect('user.refreshTokenExpiresAt')
      .where('user.refreshToken = :token', { token: refreshTokenInput })
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
