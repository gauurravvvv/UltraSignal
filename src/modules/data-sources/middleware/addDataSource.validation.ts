/**
 * AddDataSourceValidation — validates the payload, checks the referenced
 * type exists, and guards against duplicate (name, clientId) before the
 * controller writes.
 *
 * Connection fields (host/port/dbname/username/password/schema) match
 * the rules used by `testDataSourceConnection.validation.ts`. Tenants
 * should call Test Connection before submitting Create, but the rules
 * live in both validators so each endpoint is self-sufficient.
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

const SCHEMA_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const schema = Joi.object({
  name: fields.groupName.required(),
  description: fields.description.optional().allow('', null),
  typeId: fields.id.required().messages({
    'any.required': 'Type is required',
    'string.empty': 'Type is required',
  }),
  host: Joi.string().trim().min(1).max(255).required().messages({
    'string.empty': 'Host is required',
    'any.required': 'Host is required',
    'string.max': 'Host must not exceed 255 characters',
  }),
  port: Joi.number().integer().min(1).max(65535).required().messages({
    'number.base': 'Port must be a number',
    'number.integer': 'Port must be an integer',
    'number.min': 'Port must be between 1 and 65535',
    'number.max': 'Port must be between 1 and 65535',
    'any.required': 'Port is required',
  }),
  dbname: Joi.string().trim().min(1).max(128).required().messages({
    'string.empty': 'Database name is required',
    'any.required': 'Database name is required',
  }),
  username: Joi.string().trim().min(1).max(128).required().messages({
    'string.empty': 'Username is required',
    'any.required': 'Username is required',
  }),
  password: Joi.string().min(1).max(256).required().messages({
    'string.empty': 'Password is required',
    'any.required': 'Password is required',
  }),
  schema: Joi.string()
    .trim()
    .min(1)
    .max(64)
    .pattern(SCHEMA_NAME_PATTERN)
    .required()
    .messages({
      'string.empty': 'Schema is required',
      'any.required': 'Schema is required',
      'string.pattern.base':
        'Schema must start with a letter or underscore and contain only letters, numbers, and underscores',
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
