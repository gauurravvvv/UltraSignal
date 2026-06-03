/**
 * VerifyResourceMiddleware — loads the caller's `Organisation` row into
 * `res.locals.orgData` for downstream controllers and middleware.
 *
 * The org id is taken solely from `res.locals.organisationId`, which
 * `AuthMiddleware` set from the JWT payload. We don't read the
 * `x-organization-id` header, the `:orgId` URL segment, or
 * `req.body.organisation` — the JWT is the only signed source of org
 * identity, so anything the FE puts in headers, URLs, or bodies is
 * silently ignored.
 */
import { NextFunction, Request, Response } from 'express';
import { CODE } from '../../../config/config';
import {
  GENERIC,
  ORGANISATION as ORGANISATION_MSG,
} from '../constants/response.messages';
import { Organisation } from '../db/entities/organisation.entity';
import { getErrorMessage } from '../utility/getErrorMessage';
import Logger from '../utility/logger/logger';
import sendResponse from '../utility/response';

const VerifyResourceMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const orgId = res.locals.organisationId;

    if (!orgId) {
      // AuthMiddleware should have populated this. If we get here without
      // it, the route is mis-wired (AuthMiddleware missing or skipped).
      return sendResponse(res, false, CODE.UNAUTHORIZED, GENERIC.UNAUTHORIZED);
    }

    const org = await Organisation.findOne({
      where: { id: orgId },
      relations: ['config'],
    });

    if (!org) {
      return sendResponse(
        res,
        false,
        CODE.NOT_FOUND,
        ORGANISATION_MSG.NOT_FOUND,
      );
    }

    res.locals.loggedInOrgId = orgId;
    res.locals.orgData = org;

    next();
  } catch (error) {
    Logger.error(`Middleware error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default VerifyResourceMiddleware;
