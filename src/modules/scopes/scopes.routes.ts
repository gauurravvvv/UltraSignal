/**
 * Scope routes — mounted at /api/v1/scopes.
 *
 *   GET  /  → list every scope (System, Organization, User, Ad-hoc)
 *
 * Reference data — any authenticated user can fetch it. No
 * permission gate beyond `AuthMiddleware` because the catalog is
 * platform-wide and not sensitive. Same pattern as `access-levels`.
 */
import { Router } from 'express';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import ScopeController from './controllers/scope.controller';

const router = Router();
const controller = new ScopeController();

router.get('/', AuthMiddleware, controller.list);

export default router;
