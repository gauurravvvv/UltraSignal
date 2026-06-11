/**
 * UpdateDataSourceValidation — partial update. All fields optional except
 * `id` (which comes from the path param).
 *
 * Uniqueness check uses `Not(id)` so submitting the same name as the
 * current row doesn't trigger a false conflict. If `typeId` is in the
 * payload, the referenced type must exist & be active.
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
import { DataSourceType } from '../../../shared/db/entities/data-source-type.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { fields } from '../../../shared/utility/joi.schemas';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';

const schema = Joi.object({
  id: fields.id.required(),
  name: fields.groupName.optional(),
  description: fields.description.optional().allow('', null),
  typeId: fields.id.optional(),
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

    const { id, name, typeId } = value;

    const existing = await AppDataSource.getRepository(DataSource).findOne({
      where: { id, clientId: clientData.id },
    });
    if (!existing) {
      return sendResponse(res, false, CODE.NOT_FOUND, DS_MSG.NOT_FOUND);
    }

    if (typeId) {
      const type = await AppDataSource.getRepository(DataSourceType).findOne({
        where: { id: typeId, status: 1 },
      });
      if (!type) {
        return sendResponse(res, false, CODE.NOT_FOUND, DS_MSG.TYPE_NOT_FOUND);
      }
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
