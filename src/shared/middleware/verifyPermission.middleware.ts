/**
 * VerifyPermissionMiddleware — factory that returns a middleware enforcing
 * a permission value AND a minimum access level on the logged-in user.
 *
 * Usage:
 *   VerifyPermissionMiddleware('users')                    // defaults to READ
 *   VerifyPermissionMiddleware('users', ACCESS.READ)       // explicit
 *   VerifyPermissionMiddleware('users', ACCESS.WRITE)      // POST/PUT routes
 *   VerifyPermissionMiddleware('users', ACCESS.FULL)       // DELETE / admin actions
 *
 * Verb → level convention applied across the codebase:
 *   GET                                    → READ
 *   POST  (create)  /  PUT  (update)       → WRITE
 *   DELETE / bulk-delete / unlock / reset  → FULL
 *
 * Comparison rule: `userLevel >= requiredLevel`. Because levels are
 * ordered (NONE=0 < READ=1 < WRITE=2 < FULL=3), granting a higher
 * level automatically implies all lower ones — a FULL user passes a
 * READ-required route without an extra row in role_permission_mapping.
 *
 * JWT shape: the token carries a flat `permissions: [{ value, level }]`
 * array. `findLevel()` also handles the legacy nested `subPermissions`
 * shape defensively, so an old token in flight during a deploy doesn't
 * get spuriously blocked.
 *
 * Security note: NO role-name bypass. Even the platform System Admin
 * must carry the required permission + level in their JWT. Their
 * deliberately-narrow set keeps per-client routes 401 at this layer.
 */
import { NextFunction, Request, Response } from 'express';
import { CODE } from '../../../config/config';
import { ACCESS } from '../constants/permissions/access';
import { GENERIC } from '../constants/response.messages';
import { getErrorMessage } from '../utility/getErrorMessage';
import Logger from '../utility/logger/logger';
import sendResponse from '../utility/response';

interface PermNode {
  value: string;
  level?: number;
  /** Legacy nested shape — defensively handled. */
  subPermissions?: PermNode[];
  children?: PermNode[];
}

/**
 * Walk the JWT permission tree (flat or nested) and return the user's
 * effective level on `permissionValue`. Returns NONE (0) if the value
 * isn't present — which has the same meaning as "no access".
 */
const findLevel = (
  permissions: PermNode[],
  permissionValue: string,
): number => {
  for (const perm of permissions) {
    if (perm.value === permissionValue) {
      return typeof perm.level === 'number' ? perm.level : ACCESS.NONE;
    }
    // Defensive: support both `subPermissions` (legacy) and `children`
    // (current /session tree shape) when the JWT carries a nested array.
    const nested = perm.subPermissions ?? perm.children;
    if (nested && nested.length > 0) {
      const found = findLevel(nested, permissionValue);
      if (found > ACCESS.NONE) return found;
    }
  }
  return ACCESS.NONE;
};

const VerifyPermissionMiddleware = (
  requiredPermission: string,
  requiredLevel: number = ACCESS.READ,
) => {
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

      const userLevel = findLevel(
        permissions as PermNode[],
        requiredPermission,
      );
      if (userLevel < requiredLevel) {
        Logger.debug(
          `VerifyPermission: blocked — wanted ${requiredPermission} >= ${requiredLevel}, ` +
            `user has ${userLevel}`,
        );
        return sendResponse(
          res,
          false,
          CODE.UNAUTHORIZED,
          GENERIC.UNAUTHORIZED,
        );
      }

      // Expose the user's effective level so downstream controllers can
      // make finer-grained decisions (e.g. allow DELETE only when level
      // === FULL even though the route as a whole was gated at WRITE).
      res.locals.permissionLevel = userLevel;

      next();
    } catch (error) {
      Logger.error(`Permission middleware error: ${getErrorMessage(error)}`);
      return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
    }
  };
};

export default VerifyPermissionMiddleware;
