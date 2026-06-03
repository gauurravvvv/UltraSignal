/**
 * DeleteClientValidation — confirms the target client exists and is accessible before
 * the controller performs the destructive delete.
 *
 * Authorisation is enforced upstream by `VerifyPermissionMiddleware('clientManagement')`
 * in the clients router; this middleware is now payload-only.
 *
 * The inner try-catch around the DB lookup converts a TypeORM UUID parse error (malformed
 * `id`) into a 400 rather than letting it bubble up as a 500 — UUIDs are validated by
 * TypeORM at query time, not by Joi, so invalid formats need to be caught here.
 * The entity is pre-fetched into `res.locals.client` so the controller can log its name in
 * the audit trail without a second query.
 */
import { NextFunction, Request, Response } from 'express';
import { CODE, VALIDATION_MESSAGES } from '../../../../config/config';
import {
  GENERIC,
  CLIENT as CLIENT_MSG,
} from '../../../shared/constants/response.messages';
import { Client } from '../../../shared/db/entities/client.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const DeleteClientValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        VALIDATION_MESSAGES.ID.REQUIRED,
      );
    }

    try {
      const client = await Client.findOne({ where: { id } });

      if (!client) {
        return sendResponse(
          res,
          false,
          CODE.NOT_FOUND,
          CLIENT_MSG.NOT_FOUND,
        );
      }

      res.locals.client = client;
    } catch (err) {
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        CLIENT_MSG.INVALID_ID,
      );
    }

    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default DeleteClientValidation;
