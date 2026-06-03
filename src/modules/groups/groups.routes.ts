/**
 * Group routes — mounted at /api/v1/groups. All endpoints require the
 * `groupManagement` permission (matches the seeded organisationAdmin
 * permission tree value).
 *
 *  POST   /                       create
 *  GET    /                       list
 *  GET    /:id             read one
 *  PUT    /:id             update
 *  DELETE /:id             delete
 *  POST   /bulk-delete     bulk delete
 */
import { Router } from 'express';
import { idFromParam } from '../../shared/middleware/idFromParam.middleware';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import VerifyResourceMiddleware from '../../shared/middleware/verifyResource.middleware';
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
  VerifyPermissionMiddleware('groupManagement'),
  VerifyResourceMiddleware,
  AddGroupValidation,
  groupController.add,
);

router.get(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('groupManagement'),
  VerifyResourceMiddleware,
  ListGroupValidation,
  groupController.list,
);

router.get(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('groupManagement'),
  VerifyResourceMiddleware,
  GetGroupValidation,
  groupController.get,
);

router.put(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('groupManagement'),
  VerifyResourceMiddleware,
  idFromParam('id'),
  UpdateGroupValidation,
  groupController.update,
);

router.delete(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('groupManagement'),
  VerifyResourceMiddleware,
  DeleteGroupValidation,
  groupController.delete,
);

router.post(
  '/bulk-delete',
  AuthMiddleware,
  VerifyPermissionMiddleware('groupManagement'),
  VerifyResourceMiddleware,
  DeleteGroupBulkValidation,
  groupController.deleteBulk,
);

export default router;
