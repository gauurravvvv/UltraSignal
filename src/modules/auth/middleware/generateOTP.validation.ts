/**
 * GetOtpValidation — validates POST /auth/generateOTP body.
 * Also does a DB existence check on the organisation here (rather than
 * in the controller) so we can return a clean 400 before doing any
 * heavier password-flow work.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  ORGANISATION,
} from '../../../shared/constants/response.messages';
import { Organisation } from '../../../shared/db/entities/organisation.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { fields } from '../../../shared/utility/joi.schemas';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const GetOtpValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const schema = Joi.object({
      username: fields.username.required(),
      email: fields.email.required(),
      organisation: Joi.string().trim().required().messages({
        'string.empty': 'Organisation is required',
        'any.required': 'Organisation is required',
      }),
    });

    const { error, value } = validateSchema(schema, req.body);
    if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);

    req.body = value;

    const isOrgExists = await Organisation.findOne({
      where: { name: value.organisation },
    });

    if (!isOrgExists) {
      return sendResponse(res, false, CODE.BAD_REQUEST, ORGANISATION.NOT_FOUND);
    }

    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default GetOtpValidation;
