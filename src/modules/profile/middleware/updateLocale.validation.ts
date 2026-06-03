/**
 * UpdateLocaleValidation — validates that the requested locale is one of the supported
 * codes before the controller persists it to the user profile.
 *
 * The valid set is derived from `SUPPORTED_LOCALES` (the same constant used to build
 * i18n bundles) so adding a new locale to i18n automatically makes it a valid choice
 * here without touching this file.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import { SUPPORTED_LOCALES } from '../../../shared/utility/i18n';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const schema = Joi.object({
  locale: Joi.string()
    .valid(...SUPPORTED_LOCALES)
    .required()
    .messages({
      'any.required': 'Locale is required',
      'any.only': `Locale must be one of: ${SUPPORTED_LOCALES.join(', ')}`,
    }),
});

const UpdateLocaleValidation = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { error, value } = validateSchema(schema, req.body);
  if (error) {
    return sendResponse(res, false, CODE.BAD_REQUEST, error);
  }
  req.body = value;
  next();
};

export default UpdateLocaleValidation;
