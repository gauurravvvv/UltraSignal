/**
 * DeleteOrganisationBulkValidation — validates a batch delete request and verifies that
 * every requested org ID exists before the controller deletes any of them.
 *
 * Authorisation is enforced upstream by `VerifyPermissionMiddleware('orgManagement')`
 * in the orgs router; this middleware is now payload-only.
 *
 * The length equality check (`orgs.length !== ids.length`) enforces all-or-nothing
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
  ORGANISATION as ORGANISATION_MSG,
} from '../../../shared/constants/response.messages';
import { Organisation } from '../../../shared/db/entities/organisation.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { fields } from '../../../shared/utility/joi.schemas';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const schema = Joi.object({
  ids: Joi.array().items(fields.id).min(1).required().messages({
    'array.min': 'At least one organisation must be selected',
    'any.required': 'Organisation ids are required',
  }),
  justification: fields.justification.optional(),
});

const DeleteOrganisationBulkValidation = async (
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

    const orgs = await Organisation.find({ where: { id: In(ids) } });
    if (orgs.length !== ids.length) {
      return sendResponse(
        res,
        false,
        CODE.NOT_FOUND,
        ORGANISATION_MSG.NOT_FOUND,
      );
    }

    res.locals.orgs = orgs;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default DeleteOrganisationBulkValidation;
