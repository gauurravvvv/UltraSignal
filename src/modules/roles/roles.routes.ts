/**
 * Role routes — mounted at /api/v1/roles. All endpoints require
 * `roleManagement` permission (except /permissions which is a static
 * catalog).
 *
 *  POST   /                       create
 *  GET    /                       list
 *  GET    /:id             read one
 *  PUT    /:id             update
 *  DELETE /:id             delete
 *  POST   /bulk-delete     bulk delete
 *  GET    /permissions            full static permission catalog (no DB hit)
 */
import { Router } from 'express';
import { idFromParam } from '../../shared/middleware/idFromParam.middleware';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import VerifyResourceMiddleware from '../../shared/middleware/verifyResource.middleware';
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
  VerifyPermissionMiddleware('roleManagement'),
  VerifyResourceMiddleware,
  AddRoleValidation,
  roleController.add,
);

router.get(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('roleManagement'),
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
  VerifyPermissionMiddleware('roleManagement'),
  VerifyResourceMiddleware,
  GetRoleValidation,
  roleController.get,
);

router.put(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('roleManagement'),
  VerifyResourceMiddleware,
  idFromParam('id'),
  UpdateRoleValidation,
  roleController.update,
);

router.delete(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('roleManagement'),
  VerifyResourceMiddleware,
  DeleteRoleValidation,
  roleController.delete,
);

router.post(
  '/bulk-delete',
  AuthMiddleware,
  VerifyPermissionMiddleware('roleManagement'),
  VerifyResourceMiddleware,
  DeleteRoleBulkValidation,
  roleController.deleteBulk,
);

export default router;
