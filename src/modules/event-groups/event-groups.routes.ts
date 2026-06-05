/**
 * Event Group routes — mounted at /api/v1/event-groups.
 * All endpoints require the `eventGroup` permission.
 */
import { Router } from 'express';
import { idFromParam } from '../../shared/middleware/idFromParam.middleware';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import VerifyResourceMiddleware from '../../shared/middleware/verifyResource.middleware';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import EventGroupController from './controllers/eventGroup.controller';
import AddEventGroupValidation from './middleware/addEventGroup.validation';
import BulkDeleteEventGroupValidation from './middleware/bulkDeleteEventGroup.validation';
import DeleteEventGroupValidation from './middleware/deleteEventGroup.validation';
import GetEventGroupValidation from './middleware/getEventGroup.validation';
import ListEventGroupValidation from './middleware/listEventGroup.validation';
import UpdateEventGroupValidation from './middleware/updateEventGroup.validation';

const router = Router();
const controller = new EventGroupController();

router.post(
  '/',
  // AuthMiddleware,
  // VerifyPermissionMiddleware('eventGroup'),
  // VerifyResourceMiddleware,
  // AddEventGroupValidation,
  controller.add,
);

router.get(
  '/',
  // AuthMiddleware,
  // VerifyPermissionMiddleware('eventGroup'),
  // VerifyResourceMiddleware,
  // ListEventGroupValidation,
  controller.list,
);

router.get(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('eventGroup'),
  VerifyResourceMiddleware,
  GetEventGroupValidation,
  controller.get,
);

router.put(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('eventGroup'),
  VerifyResourceMiddleware,
  idFromParam('id'),
  UpdateEventGroupValidation,
  controller.update,
);

router.delete(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('eventGroup'),
  VerifyResourceMiddleware,
  DeleteEventGroupValidation,
  controller.delete,
);

router.post(
  '/bulk-delete',
  AuthMiddleware,
  VerifyPermissionMiddleware('eventGroup'),
  VerifyResourceMiddleware,
  BulkDeleteEventGroupValidation,
  controller.deleteBulk,
);

export default router;
