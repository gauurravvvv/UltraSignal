/**
 * Permission catalog routes — mounted at /api/v1/permissions.
 *
 *   GET  /                          →  full catalog (modules + screens)
 *   GET  /?scope=SYSTEM             →  System Admin role editor
 *   GET  /?scope=ORG&roleId=<uuid>  →  ORG catalog enriched with this
 *                                       role's current level per screen
 *
 * Any authenticated user can read the catalog — the role editor screen
 * gates on the `roles` permission separately when CRUDing roles. The
 * catalog itself is metadata, not a tenant resource, so no
 * VerifyResourceMiddleware is needed.
 */
import { Router } from 'express';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import PermissionController from './controllers/permission.controller';

const router = Router();
const controller = new PermissionController();

router.get('/', AuthMiddleware, controller.list);

export default router;
