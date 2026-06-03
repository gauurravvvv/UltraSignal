/**
 * DeleteOrganisationValidation — confirms the target org exists and is accessible before
 * the controller performs the destructive delete.
 *
 * Authorisation is enforced upstream by `VerifyPermissionMiddleware('orgManagement')`
 * in the orgs router; this middleware is now payload-only.
 *
 * The inner try-catch around the DB lookup converts a TypeORM UUID parse error (malformed
 * `id`) into a 400 rather than letting it bubble up as a 500 — UUIDs are validated by
 * TypeORM at query time, not by Joi, so invalid formats need to be caught here.
 * The entity is pre-fetched into `res.locals.org` so the controller can log its name in
 * the audit trail without a second query.
 */
import { NextFunction, Request, Response } from 'express';
import { CODE, VALIDATION_MESSAGES } from '../../../../config/config';
import {
  GENERIC,
  ORGANISATION as ORGANISATION_MSG,
} from '../../../shared/constants/response.messages';
import { Organisation } from '../../../shared/db/entities/organisation.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const DeleteOrganisationValidation = async (
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
      const org = await Organisation.findOne({ where: { id } });

      if (!org) {
        return sendResponse(
          res,
          false,
          CODE.NOT_FOUND,
          ORGANISATION_MSG.NOT_FOUND,
        );
      }

      res.locals.org = org;
    } catch (err) {
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        ORGANISATION_MSG.INVALID_ID,
      );
    }

    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default DeleteOrganisationValidation;
