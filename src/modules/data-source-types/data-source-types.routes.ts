/**
 * Data Source Type routes — mounted at /api/v1/data-source-types.
 *
 *   GET  /  → list every active type (AEMS, UAN, ...) for the type
 *            dropdown on the Data Source create / edit screen.
 *
 * The catalog is platform-level reference data — any authenticated user
 * with `dataSource` READ can fetch it. The READ gate keeps the response
 * scoped to roles that are actually allowed to interact with data
 * sources at all, rather than leaking the catalog to every JWT holder.
 */
import { Router } from 'express';
import { ACCESS } from '../../shared/constants/permissions/access';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import VerifyResourceMiddleware from '../../shared/middleware/verifyResource.middleware';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import DataSourceTypeController from './controllers/data-source-type.controller';

const router = Router();
const controller = new DataSourceTypeController();

router.get(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('dataSource', ACCESS.READ),
  VerifyResourceMiddleware,
  controller.list,
);

export default router;
