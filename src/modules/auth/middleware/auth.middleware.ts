/**
 * AuthMiddleware — validates the JWT on every protected route.
 *
 * Reads the token from the `x-auth-token` request header, verifies the
 * signature against JWT_SECRET_KEY, then populates res.locals so that
 * downstream controllers don't need to re-decode the token themselves:
 *
 *   res.locals.loggedInId       — the authenticated user's UUID
 *   res.locals.loggedInRole     — SYSTEM_ADMIN | CLIENT_ADMIN | CLIENT_USER
 *   res.locals.loggedInUsername — for audit logging
 *   res.locals.loggedInName     — display name
 *   res.locals.permissions      — permission tree from token
 *   res.locals.clientName       — client name string
 *   res.locals.clientId         — client UUID
 *   res.locals.locale           — user's saved language preference (skipped
 *                                  when ?lang= query param is present so
 *                                  per-request overrides still work)
 *
 * Returns 401 for missing/invalid tokens and 440 (session expired) for
 * expired ones so the frontend can distinguish "never logged in" from
 * "session timed out".
 */
import { NextFunction, Request, Response } from 'express';
import { verify } from 'jsonwebtoken';
import { CODE, JWT_SECRET_KEY } from '../../../../config/config';
import {
  AUTH as AUTH_MSG,
  GENERIC,
} from '../../../shared/constants/response.messages';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const AuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req?.headers['x-auth-token']?.toString();
  if (typeof token !== 'undefined') {
    try {
      const data: any = verify(token, JWT_SECRET_KEY);

      const {
        role,
        id,
        clientName,
        clientId,
        permissions,
        username,
        name,
        locale,
      } = data;

      res.locals.loggedInId = id;
      res.locals.loggedInRole = role;
      res.locals.loggedInUsername = username;
      res.locals.loggedInName = name;
      res.locals.permissions = permissions;
      res.locals.clientName = clientName;
      res.locals.clientId = clientId;

      // Apply user's saved locale from token unless caller explicitly set ?lang=
      if (locale && !req.query.lang) {
        res.locals.locale = locale;
      }

      Logger.debug(
        `AuthMiddleware: authenticated user=${username} role=${role} client=${clientName}`,
      );
      next();
    } catch (error) {
      const message = getErrorMessage(error);

      if (message === 'invalid signature') {
        Logger.warn(`AuthMiddleware: invalid token signature on ${req.path}`);
        sendResponse(res, false, CODE.UNAUTHORIZED, AUTH_MSG.INVALID_TOKEN);
        return false;
      }

      if (message === 'jwt expired') {
        Logger.info(`AuthMiddleware: expired token on ${req.path}`);
        sendResponse(
          res,
          false,
          CODE.SESSION_EXPIRED,
          AUTH_MSG.SESSION_EXPIRED,
        );
        return false;
      }

      Logger.warn(`AuthMiddleware: token verification failed — ${message}`);
      sendResponse(res, false, CODE.UNAUTHORIZED, AUTH_MSG.INVALID_TOKEN);
    }
  } else {
    Logger.warn(`AuthMiddleware: no x-auth-token header on ${req.path}`);
    sendResponse(res, false, CODE.UNAUTHORIZED, GENERIC.UNAUTHORIZED);
  }
};

export default AuthMiddleware;
