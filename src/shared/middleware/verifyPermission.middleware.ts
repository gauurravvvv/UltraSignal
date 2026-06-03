/**
 * VerifyPermissionMiddleware — factory that returns a middleware
 * enforcing a specific permission value on the logged-in user.
 *
 * Every role (including SYSTEM-ADMIN) must carry the required
 * permission in their JWT's permission tree. The previous version
 * short-circuited for SYSTEM-ADMIN, giving them implicit full
 * access across every client's data — that was a security
 * footgun for a platform that ships to vendors who run their own
 * tenants end-to-end. The bypass is gone; system admins now have
 * exactly the permissions enumerated in their master-DB Role row
 * (see `src/shared/constants/permissions/systemAdminV2.ts`), and
 * nothing more.
 *
 * The recursive `hasPermissionValue` walk still handles both
 * top-level and sub-permission entries so a route that asks for
 * `orgManagement` can satisfy itself with a permission nested
 * under `systemManagement`.
 */
import { NextFunction, Request, Response } from 'express';
import { CODE } from '../../../config/config';
import { GENERIC } from '../constants/response.messages';
import { getErrorMessage } from '../utility/getErrorMessage';
import Logger from '../utility/logger/logger';
import sendResponse from '../utility/response';

const hasPermissionValue = (
  permissions: any[],
  permissionValue: string,
): boolean => {
  for (const perm of permissions) {
    if (perm.value === permissionValue) return true;
    if (
      perm.subPermissions &&
      hasPermissionValue(perm.subPermissions, permissionValue)
    ) {
      return true;
    }
  }
  return false;
};

const VerifyPermissionMiddleware = (requiredPermission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const { permissions } = res.locals;

      if (!permissions || !Array.isArray(permissions)) {
        return sendResponse(
          res,
          false,
          CODE.UNAUTHORIZED,
          GENERIC.UNAUTHORIZED,
        );
      }

      if (!hasPermissionValue(permissions, requiredPermission)) {
        return sendResponse(
          res,
          false,
          CODE.UNAUTHORIZED,
          GENERIC.UNAUTHORIZED,
        );
      }

      next();
    } catch (error) {
      Logger.error(`Permission middleware error: ${getErrorMessage(error)}`);
      return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
    }
  };
};

export default VerifyPermissionMiddleware;
