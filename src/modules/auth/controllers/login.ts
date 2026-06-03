/**
 * login — authenticates a user and issues JWT access + refresh tokens.
 *
 * Single DB model: all users (system admins and client users alike) live in
 * the global AppDataSource. Permissions resolve via UserGroupMapping →
 * Group → Role for everyone; there is no longer a separate
 * "default client / system admin" code path.
 *
 * Security model:
 *  - Failed attempts are counted and the account locks after maxLoginAttempts.
 *  - Locks auto-expire after accountLockDurationHours (client config).
 *  - On success, a new opaque refresh token is written to DB (overwrites the
 *    previous one), enforcing single-session per user.
 *  - Sensitive fields are stripped from the user object before sending it back.
 */
import crypto from 'crypto';
import { Request, Response } from 'express';
import {
  ACCESS_TOKEN_EXPIRY,
  CODE,
  MAX_FAILED_LOGIN_ATTEMPTS,
  REFRESH_TOKEN_EXPIRY_DAYS,
} from '../../../../config/config';
import {
  AUTH as AUTH_MSG,
  GENERIC,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { Client } from '../../../shared/db/entities/client.entity';
import { User } from '../../../shared/db/entities/user.entity';
import { getActiveAnnouncementsForUser } from '../../../shared/helpers/announcements/getActiveAnnouncementsForUser';
import { decryptForClient } from '../../../shared/services/crypto.service';
import { generateSecureSessionID } from '../../../shared/utility/generateSessionId';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { createToken } from '../../../shared/utility/jwt';
import Logger from '../../../shared/utility/logger/logger';
import { resolveUserPermissions } from '../../../shared/utility/resolveUserPermissions';
import sendResponse from '../../../shared/utility/response';

const login = async (req: Request, res: Response) => {
  Logger.info(`Login request`);

  const { client: clientNameInput, username, password } = req.body;

  try {
    const client = await Client.findOne({
      where: { name: clientNameInput },
      relations: ['config'],
    });

    if (!client) {
      // Generic message + 401: returning "client not found" with 404
      // would let an unauthenticated attacker enumerate valid client
      // names by probing the login form.
      sendResponse(res, false, CODE.UNAUTHORIZED, AUTH_MSG.LOGIN_FAILED);
      return;
    }

    const maxAttempts =
      client.config?.maxLoginAttempts || MAX_FAILED_LOGIN_ATTEMPTS;

    const user = await AppDataSource.getRepository(User).findOne({
      where: {
        username: username,
        clientId: client.id,
        clientName: clientNameInput,
      },
    });

    if (!user) {
      return sendResponse(res, false, CODE.UNAUTHORIZED, AUTH_MSG.LOGIN_FAILED);
    }

    if (!user.password) {
      return sendResponse(res, false, CODE.FORBIDDEN, AUTH_MSG.PASSWORD_NOT_SET);
    }

    // Account-lock check (auto-unlock if lock duration elapsed)
    if (user.accountLockedAt) {
      const lockDurationHours = client.config?.accountLockDurationHours ?? 1;
      if (lockDurationHours > 0) {
        const lockExpiry = new Date(
          user.accountLockedAt.getTime() + lockDurationHours * 60 * 60 * 1000,
        );
        if (new Date() >= lockExpiry) {
          user.accountLockedAt = null;
          user.failedLoginAttempts = 0;
          await AppDataSource.getRepository(User).save(user);
        }
      }
      if (user.accountLockedAt) {
        return sendResponse(res, false, CODE.FORBIDDEN, AUTH_MSG.ACCOUNT_LOCKED);
      }
    }

    if (password != decryptForClient(user.password, client.config)) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= maxAttempts) {
        user.accountLockedAt = new Date();
        user.refreshToken = null;
        user.refreshTokenExpiresAt = null;
      }
      await AppDataSource.getRepository(User).save(user);

      const isNowLocked = !!user.accountLockedAt;
      return sendResponse(
        res,
        false,
        isNowLocked ? CODE.FORBIDDEN : CODE.UNAUTHORIZED,
        isNowLocked ? AUTH_MSG.ACCOUNT_LOCKED : AUTH_MSG.LOGIN_FAILED,
      );
    }

    user.failedLoginAttempts = 0;
    user.lastLogin = new Date();
    user.isFirstLogin = false;
    user.sessionId = generateSecureSessionID();
    await AppDataSource.getRepository(User).save(user);

    // Permissions resolve via Group → Role for every user.
    const resolved = await resolveUserPermissions(AppDataSource, user.id);
    if (resolved.permissions.length === 0) {
      return sendResponse(res, false, CODE.UNAUTHORIZED, AUTH_MSG.ROLE_INACTIVE);
    }
    const permissions = resolved.permissions;
    const tokenRole = resolved.roleName;

    const tokenObject = {
      id: user.id,
      name: `${user.firstName} ${user.lastName ?? ''}`,
      email: user.email,
      username: user.username,
      isFirstLogin: true,
      role: tokenRole,
      clientId: user.clientId,
      clientName: user.clientName,
      permissions,
      locale: user.locale || 'en',
    };

    if (user.locale) {
      res.locals.locale = user.locale;
    }

    const accessToken = createToken(tokenObject, ACCESS_TOKEN_EXPIRY);

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenExpiresAt = new Date(
      Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    user.refreshToken = refreshToken;
    user.refreshTokenExpiresAt = refreshTokenExpiresAt;
    await AppDataSource.getRepository(User).save(user);

    // Strip sensitive fields before sending response
    const {
      password: _pw,
      refreshToken: _rt,
      refreshTokenExpiresAt: _rte,
      otp: _otp,
      sessionId: _sid,
      failedLoginAttempts: _fla,
      accountLockedAt: _ala,
      version: _v,
      createdBy: _cb,
      updatedBy: _ub,
      updatedOn: _uo,
      deletedBy: _db,
      deletedOn: _do,
      ...safeUser
    } = user;

    let announcements: unknown[] = [];
    try {
      announcements = await getActiveAnnouncementsForUser(
        AppDataSource,
        client.id,
        user.id,
      );
    } catch (err) {
      Logger.error(
        `Failed to load announcements during login for user ${user.id}: ${getErrorMessage(err)}`,
      );
    }

    sendResponse(res, true, CODE.SUCCESS, AUTH_MSG.LOGIN_SUCCESS, {
      user: safeUser,
      accessToken,
      refreshToken,
      sessionInactivityTimeout: client.config?.sessionInactivityTimeout || 30,
      announcements,
    });
  } catch (error) {
    Logger.error(`Error in login: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default login;
