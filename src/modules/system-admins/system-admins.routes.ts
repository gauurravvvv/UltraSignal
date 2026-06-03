/**
 * System Admin routes — mounted at /api/v1/system-admins. Every endpoint
 * requires the `systemAdmin` permission, which today is held only by the
 * seeded platform System Admin role (master DB). Org admins and org
 * users have no `systemAdmin` permission on their roles, so they get a
 * clean 401 from VerifyPermissionMiddleware before the validation layer
 * runs.
 *
 *  POST   /                       create
 *  GET    /                       list
 *  GET    /:id                    read one
 *  PUT    /:id                    update profile
 *  DELETE /:id                    delete
 *  POST   /bulk-delete            bulk delete
 *  PUT    /:id/password           admin-forced password reset
 *  POST   /:id/unlock             clear account lock (action, not update)
 *
 * /bulk-delete registered BEFORE /:id so Express doesn't match
 * "bulk-delete" as an id.
 */
import { Router } from 'express';
import { idFromParam } from '../../shared/middleware/idFromParam.middleware';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import SystemAdminController from './controllers/systemAdmin.controller';
import AddSystemAdminValidation from './middleware/addSystemAdmin.validation';
import DeleteSystemAdminValidation from './middleware/deleteSystemAdmin.validation';
import DeleteSystemAdminBulkValidation from './middleware/deleteSystemAdminBulk.validation';
import GetSystemAdminValidation from './middleware/getSystemAdmin.validation';
import ListSystemAdminValidation from './middleware/listSystemAdmin.validation';
import UpdatePasswordValidation from './middleware/updatePassword.validation';
import UpdateSystemAdminValidation from './middleware/updateSystemAdmin.validation';

const router = Router();
const systemAdminController = new SystemAdminController();
const requireSystemAdmin = VerifyPermissionMiddleware('systemAdmin');

router.post(
  '/',
  AuthMiddleware,
  requireSystemAdmin,
  AddSystemAdminValidation,
  systemAdminController.add,
);

router.get(
  '/',
  AuthMiddleware,
  requireSystemAdmin,
  ListSystemAdminValidation,
  systemAdminController.list,
);

router.post(
  '/bulk-delete',
  AuthMiddleware,
  requireSystemAdmin,
  DeleteSystemAdminBulkValidation,
  systemAdminController.deleteBulk,
);

router.get(
  '/:id',
  AuthMiddleware,
  requireSystemAdmin,
  GetSystemAdminValidation,
  systemAdminController.get,
);

router.put(
  '/:id',
  AuthMiddleware,
  requireSystemAdmin,
  idFromParam('id'),
  UpdateSystemAdminValidation,
  systemAdminController.update,
);

router.delete(
  '/:id',
  AuthMiddleware,
  requireSystemAdmin,
  DeleteSystemAdminValidation,
  systemAdminController.delete,
);

router.put(
  '/:id/password',
  AuthMiddleware,
  requireSystemAdmin,
  idFromParam('id'),
  UpdatePasswordValidation,
  systemAdminController.updatePassword,
);

router.post(
  '/:id/unlock',
  AuthMiddleware,
  requireSystemAdmin,
  GetSystemAdminValidation,
  systemAdminController.unlock,
);

export default router;
