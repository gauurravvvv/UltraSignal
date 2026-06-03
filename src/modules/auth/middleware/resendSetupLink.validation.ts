/**
 * ResendSetupLinkValidation — validates POST /auth/resend-setup-link body.
 * Only user ID and client ID are needed; the controller re-generates the
 * token and re-sends the welcome email internally.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import { fields } from '../../../shared/utility/joi.schemas';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const ResendSetupLinkValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const schema = Joi.object({
    id: fields.id.required().messages({
      'any.required': 'User ID is required',
    }),
    clientId: fields.id.required().messages({
      'any.required': 'Client ID is required',
    }),
  });

  const { error, value } = validateSchema(schema, req.body);
  if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);

  req.body = value;
  next();
};

export default ResendSetupLinkValidation;
