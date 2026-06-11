/**
 * listScope — returns the catalog of analysis scopes (System,
 * Organization, User, Ad-hoc) for the FE dropdowns on the threshold
 * profile, statistical constants profile, and any other scope-bound
 * resource.
 *
 * Reference data only — no per-client filtering, no pagination.
 * Ordered by `scope_id` so the FE renders System / Org / User / Ad-hoc
 * in seed order.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  SCOPE as SCOPE_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { Scope } from '../../../shared/db/entities/scope.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const listScope = async (req: Request, res: Response) => {
  Logger.info('List Scopes request');

  try {
    const scopes = await AppDataSource.getRepository(Scope).find({
      order: { scopeId: 'ASC' },
    });

    sendResponse(res, true, CODE.SUCCESS, SCOPE_MSG.LIST_FETCHED, {
      count: scopes.length,
      scopes,
    });
  } catch (error) {
    Logger.error(`Error while listing scopes: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default listScope;
