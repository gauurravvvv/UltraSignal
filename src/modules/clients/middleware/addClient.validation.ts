/**
 * AddClientValidation — validates new client creation and enforces the global
 * name uniqueness constraint before the controller writes to the master DB.
 *
 * Authorisation is no longer enforced here — the clients router runs
 * `VerifyPermissionMiddleware('clientManagement')` upstream, which only lets the
 * platform-level "System Admin" role through. This middleware is now payload-only:
 * shape, defaults, and the duplicate-name check that would break tenant isolation
 * downstream.
 *
 * Security and email config fields are optional: if omitted, the entity applies its own
 * defaults (maxLoginAttempts, accountLockDurationHours, etc.) and the mailer falls back to
 * global .env values for SMTP/SES.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  CLIENT as CLIENT_MSG,
} from '../../../shared/constants/response.messages';
import { Client } from '../../../shared/db/entities/client.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { SUPPORTED_LOCALES } from '../../../shared/utility/i18n';
import { fields } from '../../../shared/utility/joi.schemas';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const schema = Joi.object({
  name: fields.clientName.required(),
  clientCode: fields.clientCode.required(),
  description: fields.description.required(),
  // All client secrets are encrypted with the platform master key
  // (env: ULTRASIGNAL_MASTER_KEY) — no per-client crypto fields here.
  // dbHost/dbPort/dbName/dbUsername/dbPassword are not accepted: the
  // platform runs against a single DB from .env.
  adminFirstName: fields.firstName.required(),
  adminLastName: fields.lastName.required(),
  adminUsername: fields.username.required(),
  adminEmail: fields.email.required(),
  adminLocale: Joi.string()
    .valid(...SUPPORTED_LOCALES)
    .default('en')
    .messages({
      'any.only': `Admin locale must be one of: ${SUPPORTED_LOCALES.join(', ')}`,
    }),
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

const AddClientValidation = async (
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

    const isOrgExists = await Client.findOne({
      where: { name: value.name },
    });

    if (isOrgExists) {
      return sendResponse(
        res,
        false,
        CODE.ALREADY_EXISTS,
        CLIENT_MSG.ALREADY_EXISTS,
      );
    }

    const isCodeTaken = await Client.findOne({
      where: { clientCode: value.clientCode },
    });

    if (isCodeTaken) {
      return sendResponse(
        res,
        false,
        CODE.ALREADY_EXISTS,
        CLIENT_MSG.CODE_ALREADY_EXISTS,
      );
    }

    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default AddClientValidation;
