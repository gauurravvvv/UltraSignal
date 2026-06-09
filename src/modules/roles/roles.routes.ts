/**
 * Role routes — mounted at /api/v1/roles.
 *
 * Permission required: `roles`, with level depending on the verb:
 *   GET           → READ
 *   POST / PUT    → WRITE
 *   DELETE        → FULL
 *   bulk-delete   → FULL
 *
 * `/permissions` returns the static permission catalog (no DB hit) and is
 * open to any authenticated user — useful for the role-editor UI.
 */
import { Router } from 'express';
import { idFromParam } from '../../shared/middleware/idFromParam.middleware';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import VerifyResourceMiddleware from '../../shared/middleware/verifyResource.middleware';
import { ACCESS } from '../../shared/constants/permissions/access';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import RoleController from './controllers/role.controller';
import AddRoleValidation from './middleware/addRole.validation';
import DeleteRoleValidation from './middleware/deleteRole.validation';
import DeleteRoleBulkValidation from './middleware/deleteRoleBulk.validation';
import GetRoleValidation from './middleware/getRole.validation';
import ListPermissionsValidation from './middleware/listPermissions.validation';
import ListRoleValidation from './middleware/listRole.validation';
import UpdateRoleValidation from './middleware/updateRole.validation';

const router = Router();
const roleController = new RoleController();

router.post(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('roles', ACCESS.WRITE),
  VerifyResourceMiddleware,
  AddRoleValidation,
  roleController.add,
);

router.get(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('roles', ACCESS.READ),
  VerifyResourceMiddleware,
  ListRoleValidation,
  roleController.list,
);

// /permissions registered BEFORE /:id so Express doesn't match
// 'permissions' as a literal clientId value.
router.get(
  '/permissions',
  AuthMiddleware,
  VerifyResourceMiddleware,
  ListPermissionsValidation,
  roleController.permissions,
);

router.get(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('roles', ACCESS.READ),
  VerifyResourceMiddleware,
  GetRoleValidation,
  roleController.get,
);

router.put(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('roles', ACCESS.WRITE),
  VerifyResourceMiddleware,
  idFromParam('id'),
  UpdateRoleValidation,
  roleController.update,
);

router.delete(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('roles', ACCESS.FULL),
  VerifyResourceMiddleware,
  DeleteRoleValidation,
  roleController.delete,
);

router.post(
  '/bulk-delete',
  AuthMiddleware,
  VerifyPermissionMiddleware('roles', ACCESS.FULL),
  VerifyResourceMiddleware,
  DeleteRoleBulkValidation,
  roleController.deleteBulk,
);

export default router;
