/**
 * AddDataSourceValidation — validates the payload, checks the referenced
 * type exists, and guards against duplicate (name, clientId) before the
 * controller writes.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import {
  DATA_SOURCE as DS_MSG,
  GENERIC,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { DataSource } from '../../../shared/db/entities/data-source.entity';
import { DataSourceType } from '../../../shared/db/entities/data-source-type.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { fields } from '../../../shared/utility/joi.schemas';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const schema = Joi.object({
  name: fields.groupName.required(),
  description: fields.description.optional().allow('', null),
  typeId: fields.id.required().messages({
    'any.required': 'Type is required',
    'string.empty': 'Type is required',
  }),
});

const AddDataSourceValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { clientData } = res.locals;

    const { error, value } = validateSchema(schema, req.body);
    if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);
    req.body = value;

    const { name, typeId } = value;

    const type = await AppDataSource.getRepository(DataSourceType).findOne({
      where: { id: typeId, status: 1 },
    });
    if (!type) {
      return sendResponse(res, false, CODE.NOT_FOUND, DS_MSG.TYPE_NOT_FOUND);
    }

    const existing = await AppDataSource.getRepository(DataSource).findOne({
      where: { name, clientId: clientData.id },
    });
    if (existing) {
      return sendResponse(
        res,
        false,
        CODE.ALREADY_EXISTS,
        DS_MSG.ALREADY_EXISTS,
      );
    }

    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default AddDataSourceValidation;
