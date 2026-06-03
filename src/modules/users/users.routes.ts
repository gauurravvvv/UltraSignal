/**
 * User routes — mounted at /api/v1/users. All endpoints require the
 * `userManagement` permission.
 *
 *  POST   /                          create
 *  GET    /                          list
 *  GET    /:id                read one
 *  PUT    /:id                update
 *  DELETE /:id                delete
 *  POST   /bulk-delete        bulk delete
 *  PUT    /:id/password       admin password reset
 *  POST   /:id/unlock         clear account lock (action)
 *
 * Bulk create:
 *  POST   /bulk/validate             dry-run CSV validation
 *  POST   /bulk/commit               commit previously-validated users
 */
import { Router } from 'express';
import { idFromParam } from '../../shared/middleware/idFromParam.middleware';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import VerifyResourceMiddleware from '../../shared/middleware/verifyResource.middleware';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import UserController from './controllers/user.controller';
import AddUserValidation from './middleware/addUser.validation';
import BulkAddUserCommitValidation from './middleware/bulkAddUserCommit.validation';
import BulkAddUserValidateValidation from './middleware/bulkAddUserValidate.validation';
import DeleteUserValidation from './middleware/deleteUser.validation';
import DeleteUserBulkValidation from './middleware/deleteUserBulk.validation';
import GetUserValidation from './middleware/getUser.validation';
import ListUserValidation from './middleware/listUser.validation';
import UpdatePasswordValidation from './middleware/updatePassword.validation';
import UpdateUserValidation from './middleware/updateUser.validation';

const router = Router();
const userController = new UserController();

router.post(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('userManagement'),
  VerifyResourceMiddleware,
  AddUserValidation,
  userController.add,
);

router.get(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('userManagement'),
  VerifyResourceMiddleware,
  ListUserValidation,
  userController.list,
);

// Bulk create: validate-then-commit two-step flow.
// Multer (inside the validate middleware) must run BEFORE
// VerifyResource/Database so the clientId field from the multipart body
// is parsed first.
router.post(
  '/bulk/validate',
  AuthMiddleware,
  VerifyPermissionMiddleware('userManagement'),
  BulkAddUserValidateValidation,
  VerifyResourceMiddleware,
  userController.bulkAddValidate,
);

router.post(
  '/bulk/commit',
  AuthMiddleware,
  VerifyPermissionMiddleware('userManagement'),
  VerifyResourceMiddleware,
  BulkAddUserCommitValidation,
  userController.bulkAddCommit,
);

router.get(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('userManagement'),
  VerifyResourceMiddleware,
  GetUserValidation,
  userController.get,
);

router.put(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('userManagement'),
  VerifyResourceMiddleware,
  idFromParam('id'),
  UpdateUserValidation,
  userController.update,
);

router.delete(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('userManagement'),
  VerifyResourceMiddleware,
  DeleteUserValidation,
  userController.delete,
);

router.post(
  '/bulk-delete',
  AuthMiddleware,
  VerifyPermissionMiddleware('userManagement'),
  VerifyResourceMiddleware,
  DeleteUserBulkValidation,
  userController.deleteBulk,
);

router.put(
  '/:id/password',
  AuthMiddleware,
  VerifyPermissionMiddleware('userManagement'),
  VerifyResourceMiddleware,
  idFromParam('id'),
  UpdatePasswordValidation,
  userController.updatePassord,
);

router.post(
  '/:id/unlock',
  AuthMiddleware,
  VerifyPermissionMiddleware('userManagement'),
  VerifyResourceMiddleware,
  GetUserValidation,
  userController.unlock,
);

export default router;
