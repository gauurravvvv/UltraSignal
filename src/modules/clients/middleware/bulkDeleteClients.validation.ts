/**
 * BulkDeleteClientsValidation — validates a batch delete request and verifies that
 * every requested client ID exists before the controller deletes any of them.
 *
 * Authorisation is enforced upstream by `VerifyPermissionMiddleware('clientManagement')`
 * in the clients router; this middleware is now payload-only.
 *
 * The length equality check (`clients.length !== ids.length`) enforces all-or-nothing
 * semantics: if any ID is missing, the entire request is rejected rather than silently
 * skipping the missing ones. This prevents partial deletes that would be hard to audit and
 * confusing to the caller.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { In } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  CLIENT as CLIENT_MSG,
} from '../../../shared/constants/response.messages';
import { Client } from '../../../shared/db/entities/client.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { fields } from '../../../shared/utility/joi.schemas';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const schema = Joi.object({
  ids: Joi.array().items(fields.id).min(1).required().messages({
    'array.min': 'At least one client must be selected',
    'any.required': 'Client ids are required',
  }),
  justification: fields.justification.optional(),
});

const BulkDeleteClientsValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { error, value } = validateSchema(schema, req.body);
    if (error) {
      return sendResponse(res, false, CODE.BAD_REQUEST, error);
    }
    req.body = value;

    const { ids } = value;

    const clients = await Client.find({ where: { id: In(ids) } });
    if (clients.length !== ids.length) {
      return sendResponse(
        res,
        false,
        CODE.NOT_FOUND,
        CLIENT_MSG.NOT_FOUND,
      );
    }

    res.locals.clients = clients;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default BulkDeleteClientsValidation;
