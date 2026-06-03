/**
 * addRole — creates a new custom permission role for an organisation.
 *
 * `isDefault` is always set to 0 on creation — default roles are seeded at org
 * onboarding and cannot be created through this endpoint. Protecting this field
 * prevents an admin from creating a role that would then be immune to modification.
 *
 * `permissions` is stored as a JSON string rather than a relational join because
 * the permission tree is a static constant — there is no `Permission` table to
 * foreign-key against. Storing as JSON lets the schema evolve without requiring
 * a migration every time the permission tree changes.
 */
import { Request, Response } from 'express';
import { CODE, IS_DEFAULT } from '../../../../config/config';
import {
  GENERIC,
  ROLE as ROLE_MSG,
} from '../../../shared/constants/response.messages';
import { Role } from '../../../shared/db/entities/role.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { AppDataSource } from '../../../shared/db';

const addRole = async (req: Request, res: Response) => {
  Logger.info('Add Role request');

  const { name, description, selectedPermissions } = req.body;
  const { loggedInId, orgData } = res.locals;

  try {
    const role = new Role();
    role.name = name;
    role.description = description || null;
    role.permissions = JSON.stringify(selectedPermissions);
    role.organisationId = orgData.id;
    role.organisationName = orgData.name;
    role.isDefault = IS_DEFAULT.NO;
    role.status = 1;
    role.createdBy = loggedInId;

    const saved = await AppDataSource.getRepository(Role).save(role);

    sendResponse(res, true, CODE.SUCCESS, ROLE_MSG.CREATED, saved);
  } catch (error) {
    Logger.error(`Error while creating role: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default addRole;
