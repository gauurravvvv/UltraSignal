/**
 * UpdateDataSourceValidation — partial update.
 *
 * `typeId` is intentionally `forbidden()` — the upstream system (AEMS,
 * UAN, ...) is decided at creation time and cannot be switched
 * afterward. A 400 with a clear message tells the FE not to send it.
 *
 * `password` is optional. Sending it (non-empty) replaces the stored
 * encrypted value. Omitting it (or sending '' / null) leaves the
 * existing password untouched — so the FE can render the edit form
 * with a blank password field and only update credentials if the user
 * types a new one.
 *
 * Uniqueness check uses `Not(id)` so submitting the same name as the
 * current row doesn't trigger a false conflict.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { Not } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  DATA_SOURCE as DS_MSG,
  GENERIC,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { DataSource } from '../../../shared/db/entities/data-source.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { fields } from '../../../shared/utility/joi.schemas';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const SCHEMA_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const schema = Joi.object({
  id: fields.id.required(),
  name: fields.groupName.optional(),
  description: fields.description.optional().allow('', null),
  typeId: Joi.any().forbidden().messages({
    'any.unknown':
      'Type cannot be changed after creation. Remove `typeId` from the payload.',
  }),
  host: Joi.string().trim().min(1).max(255).optional(),
  port: Joi.number().integer().min(1).max(65535).optional(),
  dbname: Joi.string().trim().min(1).max(128).optional(),
  username: Joi.string().trim().min(1).max(128).optional(),
  // Password is optional on update. Empty string / null = "no change",
  // any other value = replace.
  password: Joi.string().max(256).optional().allow('', null),
  schema: Joi.string()
    .trim()
    .min(1)
    .max(64)
    .pattern(SCHEMA_NAME_PATTERN)
    .optional()
    .messages({
      'string.pattern.base':
        'Schema must start with a letter or underscore and contain only letters, numbers, and underscores',
    }),
  status: fields.status.optional(),
});

const UpdateDataSourceValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { clientData } = res.locals;

    const { error, value } = validateSchema(schema, req.body);
    if (error) return sendResponse(res, false, CODE.BAD_REQUEST, error);
    req.body = value;

    const { id, name } = value;

    const existing = await AppDataSource.getRepository(DataSource).findOne({
      where: { id, clientId: clientData.id },
    });
    if (!existing) {
      return sendResponse(res, false, CODE.NOT_FOUND, DS_MSG.NOT_FOUND);
    }

    if (name) {
      const dup = await AppDataSource.getRepository(DataSource).findOne({
        where: { id: Not(id), name, clientId: clientData.id },
      });
      if (dup) {
        return sendResponse(
          res,
          false,
          CODE.ALREADY_EXISTS,
          DS_MSG.ALREADY_EXISTS,
        );
      }
    }

    res.locals.dataSource = existing;
    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default UpdateDataSourceValidation;
