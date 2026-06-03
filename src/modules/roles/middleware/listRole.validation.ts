/**
 * ListRoleValidation — validates pagination + filter for the role list.
 *
 * The caller's client is sourced from the JWT via `res.locals.clientData.id`
 * inside the controller; no clientId query param is accepted.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import { GENERIC } from '../../../shared/constants/response.messages';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const schema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).optional(),
  filter: Joi.string().optional().allow('', null),
});

const ListRoleValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { error, value } = validateSchema(schema, req.query as any);
    if (error) {
      return sendResponse(res, false, CODE.BAD_REQUEST, error);
    }

    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default ListRoleValidation;
