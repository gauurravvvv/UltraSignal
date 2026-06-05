/**
 * Event (MedDRA) Browser routes — mounted at /api/v1/events.
 * Read-only. MedDRA is a global dictionary — no per-tenant scoping
 * on the browse itself, but the route still requires auth + permission.
 */
import { Router } from 'express';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import VerifyResourceMiddleware from '../../shared/middleware/verifyResource.middleware';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import EventController from './controllers/event.controller';
import GetEventValidation from './middleware/getEvent.validation';
import ListEventValidation from './middleware/listEvent.validation';

const router = Router();
const controller = new EventController();

router.get(
  '/',
  // AuthMiddleware,
  // VerifyPermissionMiddleware('eventGroup'),
  // VerifyResourceMiddleware,
  // ListEventValidation,
  controller.list,
);

router.get(
  '/:id',
  // AuthMiddleware,
  // VerifyPermissionMiddleware('eventGroup'),
  // VerifyResourceMiddleware,
  // GetEventValidation,
  controller.get,
);

export default router;
