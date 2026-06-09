/**
 * User routes — mounted at /api/v1/users.
 *
 * Permission required: `users`, with level depending on the verb:
 *   GET            → READ   (list / view)
 *   POST / PUT     → WRITE  (create / update)
 *   DELETE         → FULL   (delete is irreversible)
 *   bulk-delete    → FULL
 *   :id/password   → FULL   (admin password reset is sensitive)
 *   :id/unlock     → FULL   (clearing an account lock is sensitive)
 *
 * Bulk create:
 *   POST /bulk/validate  → WRITE  (dry-run; no rows written)
 *   POST /bulk/commit    → WRITE  (creates many users at once)
 */
import { Router } from 'express';
import { idFromParam } from '../../shared/middleware/idFromParam.middleware';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import VerifyResourceMiddleware from '../../shared/middleware/verifyResource.middleware';
import { ACCESS } from '../../shared/constants/permissions/access';
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
  VerifyPermissionMiddleware('users', ACCESS.WRITE),
  VerifyResourceMiddleware,
  AddUserValidation,
  userController.add,
);

router.get(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('users', ACCESS.READ),
  VerifyResourceMiddleware,
  ListUserValidation,
  userController.list,
);

router.post(
  '/bulk/validate',
  AuthMiddleware,
  VerifyPermissionMiddleware('users', ACCESS.WRITE),
  BulkAddUserValidateValidation,
  VerifyResourceMiddleware,
  userController.bulkAddValidate,
);

router.post(
  '/bulk/commit',
  AuthMiddleware,
  VerifyPermissionMiddleware('users', ACCESS.WRITE),
  VerifyResourceMiddleware,
  BulkAddUserCommitValidation,
  userController.bulkAddCommit,
);

router.get(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('users', ACCESS.READ),
  VerifyResourceMiddleware,
  GetUserValidation,
  userController.get,
);

router.put(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('users', ACCESS.WRITE),
  VerifyResourceMiddleware,
  idFromParam('id'),
  UpdateUserValidation,
  userController.update,
);

router.delete(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('users', ACCESS.FULL),
  VerifyResourceMiddleware,
  DeleteUserValidation,
  userController.delete,
);

router.post(
  '/bulk-delete',
  AuthMiddleware,
  VerifyPermissionMiddleware('users', ACCESS.FULL),
  VerifyResourceMiddleware,
  DeleteUserBulkValidation,
  userController.deleteBulk,
);

router.put(
  '/:id/password',
  AuthMiddleware,
  VerifyPermissionMiddleware('users', ACCESS.FULL),
  VerifyResourceMiddleware,
  idFromParam('id'),
  UpdatePasswordValidation,
  userController.updatePassord,
);

router.post(
  '/:id/unlock',
  AuthMiddleware,
  VerifyPermissionMiddleware('users', ACCESS.FULL),
  VerifyResourceMiddleware,
  GetUserValidation,
  userController.unlock,
);

export default router;
