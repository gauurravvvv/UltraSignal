/**
 * Group routes — mounted at /api/v1/groups.
 *
 * Permission required: `groups`, with level depending on the verb:
 *   GET           → READ
 *   POST / PUT    → WRITE
 *   DELETE        → FULL
 *   bulk-delete   → FULL
 */
import { Router } from 'express';
import { idFromParam } from '../../shared/middleware/idFromParam.middleware';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import VerifyResourceMiddleware from '../../shared/middleware/verifyResource.middleware';
import { ACCESS } from '../../shared/constants/permissions/access';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import GroupController from './controllers/group.controller';
import AddGroupValidation from './middleware/addGroup.validation';
import DeleteGroupValidation from './middleware/deleteGroup.validation';
import DeleteGroupBulkValidation from './middleware/deleteGroupBulk.validation';
import GetGroupValidation from './middleware/getGroup.validation';
import ListGroupValidation from './middleware/listGroup.validation';
import UpdateGroupValidation from './middleware/updateGroup.validation';

const router = Router();
const groupController = new GroupController();

router.post(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('groups', ACCESS.WRITE),
  VerifyResourceMiddleware,
  AddGroupValidation,
  groupController.add,
);

router.get(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('groups', ACCESS.READ),
  VerifyResourceMiddleware,
  ListGroupValidation,
  groupController.list,
);

router.get(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('groups', ACCESS.READ),
  VerifyResourceMiddleware,
  GetGroupValidation,
  groupController.get,
);

router.put(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('groups', ACCESS.WRITE),
  VerifyResourceMiddleware,
  idFromParam('id'),
  UpdateGroupValidation,
  groupController.update,
);

router.delete(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('groups', ACCESS.FULL),
  VerifyResourceMiddleware,
  DeleteGroupValidation,
  groupController.delete,
);

router.post(
  '/bulk-delete',
  AuthMiddleware,
  VerifyPermissionMiddleware('groups', ACCESS.FULL),
  VerifyResourceMiddleware,
  DeleteGroupBulkValidation,
  groupController.deleteBulk,
);

export default router;
