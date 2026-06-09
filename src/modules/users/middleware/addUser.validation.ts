/**
 * AddUserValidation — checks uniqueness and group existence before the user
 * record is created.
 *
 * Email and username are checked in separate queries rather than one combined
 * query so the error message can tell the admin which field is the duplicate —
 * a single EXISTS query would require parsing the constraint name.
 *
 * Group IDs are validated with a count-mismatch guard against active groups
 * only (status = '1'). Including inactive groups would let an admin assign a
 * user to a group that is invisible in the UI, creating a confusing permission
 * state.
 *
 * `locale` is validated against SUPPORTED_LOCALES so the welcome email is
 * always rendered in a supported language — an unknown locale would fall back
 * silently, making localisation bugs hard to detect.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  USER as USER_MSG,
} from '../../../shared/constants/response.messages';
import { Group } from '../../../shared/db/entities/group.entity';
import { User } from '../../../shared/db/entities/user.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { SUPPORTED_LOCALES } from '../../../shared/utility/i18n';
import { fields } from '../../../shared/utility/joi.schemas';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';
import { AppDataSource } from '../../../shared/db';

const schema = Joi.object({
  email: fields.email.required(),
  username: fields.username.required(),
  firstName: fields.firstName.required(),
  lastName: fields.lastName.required(),
  locale: Joi.string()
    .valid(...SUPPORTED_LOCALES)
    .default('en')
    .messages({
      'any.only': `Locale must be one of: ${SUPPORTED_LOCALES.join(', ')}`,
    }),
  groupIds: Joi.array().items(fields.id).min(1).required().messages({
    'array.min': 'At least one group must be selected',
    'any.required': 'Group selection is required',
  }),
});

const AddUserValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { clientData } = res.locals;

    const { error, value } = validateSchema(schema, req.body);
    if (error) {
      return sendResponse(res, false, CODE.BAD_REQUEST, error);
    }
    req.body = value;

    const { email, username } = value;

    const ifExistByEmail = await AppDataSource.getRepository(User).findOne({
      where: { email, clientId: clientData.id },
    });

    if (ifExistByEmail) {
      return sendResponse(
        res,
        false,
        CODE.ALREADY_EXISTS,
        USER_MSG.ALREADY_EXISTS_EMAIL,
      );
    }

    const ifExistByUsername = await AppDataSource.getRepository(User).findOne({
      where: { username, clientId: clientData.id },
    });

    if (ifExistByUsername) {
      return sendResponse(
        res,
        false,
        CODE.ALREADY_EXISTS,
        USER_MSG.ALREADY_EXISTS_USERNAME,
      );
    }

    const { groupIds } = value;
    const groups = await AppDataSource.getRepository(Group)
      .createQueryBuilder('g')
      .where('g.id IN (:...ids)', { ids: groupIds })
      .andWhere('g.clientId = :clientId', { clientId: clientData.id })
      .andWhere('g.status = :activeStatus', { activeStatus: '1' })
      .getMany();

    if (groups.length !== groupIds.length) {
      return sendResponse(
        res,
        false,
        CODE.NOT_FOUND,
        'One or more selected groups not found or inactive',
      );
    }

    res.locals.groups = groups;

    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default AddUserValidation;
