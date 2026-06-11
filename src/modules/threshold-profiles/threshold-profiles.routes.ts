/**
 * Threshold Profile routes — mounted at /api/v1/threshold-profiles.
 *
 *   GET  /   → list every threshold profile with its conditions inline
 *
 * Gated on `detectionMethod` (Business Configuration → Detection Method)
 * READ. Threshold profiles ARE the detection method configuration, so
 * the existing permission covers them. If you split detection method
 * permissions later (e.g. into thresholds + stats constants + alert
 * configs as separate sub-permissions), update this route's gate.
 */
import { Router } from 'express';
import { ACCESS } from '../../shared/constants/permissions/access';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import VerifyResourceMiddleware from '../../shared/middleware/verifyResource.middleware';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import ThresholdProfileController from './controllers/threshold-profile.controller';

const router = Router();
const controller = new ThresholdProfileController();

router.get(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('detectionMethod', ACCESS.READ),
  VerifyResourceMiddleware,
  controller.list,
);

export default router;
