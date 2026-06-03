/**
 * UpdateOrganisationValidation — validates a partial organisation update.
 *
 * Authorisation is enforced upstream by `VerifyPermissionMiddleware('orgManagement')`
 * in the orgs router; this middleware is now payload-only.
 *
 * Organisation name is intentionally excluded from the schema — names are set at
 * creation time and cannot be changed because they are used as tenant identifiers.
 *
 * Both `org` and `orgConfig` are pre-fetched into `res.locals` so the controller can
 * merge fields and save without re-querying.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  ORGANISATION as ORGANISATION_MSG,
} from '../../../shared/constants/response.messages';
import { Organisation } from '../../../shared/db/entities/organisation.entity';
import { OrganisationConfig } from '../../../shared/db/entities/organisationConfig.entity';
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

const UpdateOrganisationValidation = async (
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

    const org = await Organisation.findOne({ where: { id } });

    if (!org) {
      return sendResponse(
        res,
        false,
        CODE.NOT_FOUND,
        ORGANISATION_MSG.NOT_FOUND,
      );
    }

    const orgConfig = await OrganisationConfig.findOne({
      where: { id: org.configId },
    });

    if (!orgConfig) {
      return sendResponse(
        res,
        false,
        CODE.NOT_FOUND,
        ORGANISATION_MSG.NOT_FOUND,
      );
    }

    res.locals.org = org;
    res.locals.orgConfig = orgConfig;

    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default UpdateOrganisationValidation;
