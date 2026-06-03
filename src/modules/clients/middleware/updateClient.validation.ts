/**
 * UpdateClientValidation — validates a partial client update.
 *
 * Authorisation is enforced upstream by `VerifyPermissionMiddleware('clientManagement')`
 * in the clients router; this middleware is now payload-only.
 *
 * Client name is intentionally excluded from the schema — names are set at
 * creation time and cannot be changed because they are used as tenant identifiers.
 *
 * Both `client` and `clientConfig` are pre-fetched into `res.locals` so the controller can
 * merge fields and save without re-querying.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  CLIENT as CLIENT_MSG,
} from '../../../shared/constants/response.messages';
import { Client } from '../../../shared/db/entities/client.entity';
import { ClientConfig } from '../../../shared/db/entities/clientConfig.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { fields } from '../../../shared/utility/joi.schemas';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const schema = Joi.object({
  id: fields.id.required(),
  description: fields.description.optional(),
  status: fields.status.optional(),
  justification: fields.justification.optional(),
  maxLoginAttempts: fields.maxLoginAttempts.optional(),
  accountLockDurationHours: fields.accountLockDurationHours.optional(),
  passwordHistoryLimit: fields.passwordHistoryLimit.optional(),
  sessionInactivityTimeout: fields.sessionInactivityTimeout.optional(),
  emailProvider: fields.emailProvider.optional().allow(null),
  smtpHost: fields.smtpHost.optional().allow('', null),
  smtpPort: fields.smtpPort.optional().allow(null),
  smtpUser: fields.smtpUser.optional().allow('', null),
  smtpPassword: fields.smtpPassword.optional().allow('', null),
  smtpFrom: fields.smtpFrom.optional().allow('', null),
  sesRegion: fields.sesRegion.optional().allow('', null),
  sesAccessKeyId: fields.sesAccessKeyId.optional().allow('', null),
  sesSecretAccessKey: fields.sesSecretAccessKey.optional().allow('', null),
  sesFrom: fields.sesFrom.optional().allow('', null),
});

const UpdateClientValidation = async (
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

    const { id } = req.body;

    const client = await Client.findOne({ where: { id } });

    if (!client) {
      return sendResponse(
        res,
        false,
        CODE.NOT_FOUND,
        CLIENT_MSG.NOT_FOUND,
      );
    }

    const clientConfig = await ClientConfig.findOne({
      where: { id: client.configId },
    });

    if (!clientConfig) {
      return sendResponse(
        res,
        false,
        CODE.NOT_FOUND,
        CLIENT_MSG.NOT_FOUND,
      );
    }

    res.locals.client = client;
    res.locals.clientConfig = clientConfig;

    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default UpdateClientValidation;
