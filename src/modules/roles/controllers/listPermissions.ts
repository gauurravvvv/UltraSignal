/**
 * listPermissions — returns the static permission tree for the logged-in user's role.
 *
 * Permissions are pre-loaded into `res.locals` by VerifyResourceMiddleware from the
 * static permission constants (not the database). This controller is just the final
 * formatter — it guards against a non-array locals value for defensive completeness,
 * since the middleware should always set it.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import { ROLE as ROLE_MSG } from '../../../shared/constants/response.messages';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const listPermissions = async (req: Request, res: Response) => {
  Logger.info('List Permissions request');

  const permissions: any[] = Array.isArray(res.locals.permissions)
    ? res.locals.permissions
    : [];

  sendResponse(res, true, CODE.SUCCESS, ROLE_MSG.PERMISSIONS_FETCHED, {
    permissions,
  });
};

export default listPermissions;
