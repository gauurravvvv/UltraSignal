/**
 * System Admin routes — mounted at /api/v1/system-admins.
 *
 * Permission required: `systemAdmin` (held only by the seeded platform
 * System Admin role). Per-client users have no `systemAdmin` permission
 * so they get a clean 401 before validation runs.
 *
 * Level mapping:
 *   GET            → READ
 *   POST / PUT     → WRITE
 *   DELETE         → FULL
 *   bulk-delete    → FULL
 *   :id/password   → FULL  (admin-forced password reset is sensitive)
 *   :id/unlock     → FULL  (clearing an account lock is sensitive)
 *
 * /bulk-delete registered BEFORE /:id so Express doesn't match
 * "bulk-delete" as an id.
 */
import { Router } from 'express';
import { idFromParam } from '../../shared/middleware/idFromParam.middleware';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import { ACCESS } from '../../shared/constants/permissions/access';
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

router.post(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('systemAdmin', ACCESS.WRITE),
  AddSystemAdminValidation,
  systemAdminController.add,
);

router.get(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('systemAdmin', ACCESS.READ),
  ListSystemAdminValidation,
  systemAdminController.list,
);

router.post(
  '/bulk-delete',
  AuthMiddleware,
  VerifyPermissionMiddleware('systemAdmin', ACCESS.FULL),
  DeleteSystemAdminBulkValidation,
  systemAdminController.deleteBulk,
);

router.get(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('systemAdmin', ACCESS.READ),
  GetSystemAdminValidation,
  systemAdminController.get,
);

router.put(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('systemAdmin', ACCESS.WRITE),
  idFromParam('id'),
  UpdateSystemAdminValidation,
  systemAdminController.update,
);

router.delete(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('systemAdmin', ACCESS.FULL),
  DeleteSystemAdminValidation,
  systemAdminController.delete,
);

router.put(
  '/:id/password',
  AuthMiddleware,
  VerifyPermissionMiddleware('systemAdmin', ACCESS.FULL),
  idFromParam('id'),
  UpdatePasswordValidation,
  systemAdminController.updatePassword,
);

router.post(
  '/:id/unlock',
  AuthMiddleware,
  VerifyPermissionMiddleware('systemAdmin', ACCESS.FULL),
  GetSystemAdminValidation,
  systemAdminController.unlock,
);

export default router;
