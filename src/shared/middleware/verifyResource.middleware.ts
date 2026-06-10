/**
 * VerifyResourceMiddleware — loads the caller's `Client` row into
 * `res.locals.clientData` for downstream controllers and middleware.
 *
 * The client id is taken solely from `res.locals.clientId`, which
 * `AuthMiddleware` set from the JWT payload. We don't read the
 * `x-client-id` header, the `:clientId` URL segment, or
 * `req.body.client` — the JWT is the only signed source of client
 * identity, so anything the FE puts in headers, URLs, or bodies is
 * silently ignored.
 */
import { NextFunction, Request, Response } from 'express';
import { CODE } from '../../../config/config';
import { GENERIC, CLIENT as CLIENT_MSG } from '../constants/response.messages';
import { Client } from '../db/entities/client.entity';
import { getErrorMessage } from '../utility/getErrorMessage';
import Logger from '../utility/logger/logger';
import sendResponse from '../utility/response';

const VerifyResourceMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const clientId = res.locals.clientId;

    if (!clientId) {
      // AuthMiddleware should have populated this. If we get here without
      // it, the route is mis-wired (AuthMiddleware missing or skipped).
      return sendResponse(res, false, CODE.UNAUTHORIZED, GENERIC.UNAUTHORIZED);
    }

    const client = await Client.findOne({
      where: { id: clientId },
      relations: ['config'],
    });
    // console.log(client);

    if (!client) {
      return sendResponse(res, false, CODE.NOT_FOUND, CLIENT_MSG.NOT_FOUND);
    }

    res.locals.loggedInClientId = clientId;
    res.locals.clientData = client;

    next();
  } catch (error) {
    Logger.error(`Middleware error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default VerifyResourceMiddleware;
