/**
 * GetClientValidation — verifies the requested client exists and pre-fetches it with
 * its config relation into `res.locals.client` for the controller.
 *
 * Authorisation is enforced upstream by `VerifyPermissionMiddleware('clientManagement')`
 * in the clients router; this middleware is now payload-only.
 *
 * The `config` relation is eagerly loaded here rather than in the controller because the
 * get-client response includes config fields (security policy, email settings) — loading it
 * once in validation avoids a second round-trip. The inner try-catch converts TypeORM UUID
 * parse errors on malformed `id` params to 400 instead of 500.
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

const GetClientValidation = async (
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
      const client = await Client.findOne({
        where: { id },
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

export default GetClientValidation;
