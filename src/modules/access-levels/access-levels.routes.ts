/**
 * Access Level routes — mounted at /api/v1/access-levels.
 *
 *   GET  /     →  list every level in the catalog (None/Read/Write/Full)
 *
 * The catalog is static reference data — any authenticated user can
 * fetch it. No level-gating beyond `AuthMiddleware` is needed.
 */
import { Router } from 'express';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import AccessLevelController from './controllers/accessLevel.controller';

const router = Router();
const controller = new AccessLevelController();

router.get('/', AuthMiddleware, controller.list);

export default router;
