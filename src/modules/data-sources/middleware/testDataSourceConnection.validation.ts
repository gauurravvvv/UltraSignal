/**
 * TestDataSourceConnectionValidation — validates the connection payload
 * before the controller actually opens a socket. Catches obvious
 * malformed input (missing host, bad port number, etc.) without paying
 * the timeout cost of a connection attempt.
 *
 * The schema name pattern is restrictive on purpose: identifiers in
 * Postgres can be ANY unicode if double-quoted, but allowing the full
 * range here would let a caller inject control characters into the
 * subsequent existence check. Limiting to `[A-Za-z_][A-Za-z0-9_]*`
 * covers every realistic schema name (including UltraSignal's own
 * conventions) without that surface.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import { GENERIC } from '../../../shared/constants/response.messages';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const SCHEMA_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const schema = Joi.object({
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

const TestDataSourceConnectionValidation = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { error, value } = validateSchema(schema, req.body);
    if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);
    req.body = value;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default TestDataSourceConnectionValidation;
