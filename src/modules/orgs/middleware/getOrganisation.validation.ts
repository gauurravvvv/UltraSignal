/**
 * GetOrganisationValidation — verifies the requested org exists and pre-fetches it with
 * its config relation into `res.locals.org` for the controller.
 *
 * Authorisation is enforced upstream by `VerifyPermissionMiddleware('orgManagement')`
 * in the orgs router; this middleware is now payload-only.
 *
 * The `config` relation is eagerly loaded here rather than in the controller because the
 * get-org response includes config fields (security policy, email settings) — loading it
 * once in validation avoids a second round-trip. The inner try-catch converts TypeORM UUID
 * parse errors on malformed `id` params to 400 instead of 500.
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

const GetOrganisationValidation = async (
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
      const org = await Organisation.findOne({
        where: { id },
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

export default GetOrganisationValidation;
