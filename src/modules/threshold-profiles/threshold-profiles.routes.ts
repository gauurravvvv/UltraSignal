/**
 * Threshold Profile routes — mounted at /api/v1/threshold-profiles.
 *
 *   GET   /          → list every threshold profile with its conditions inline
 *   POST  /:id/copy  → clone a profile (and all its conditions) under a
 *                      new code + displayName supplied in the body
 *
 * Gated on `detectionMethod` (Business Configuration → Detection Method).
 * READ for the list, WRITE for the copy. If you later split detection
 * method permissions into thresholds + stats constants + alert configs
 * as separate sub-permissions, update these gates.
 */
import { Router } from 'express';
import { ACCESS } from '../../shared/constants/permissions/access';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import VerifyResourceMiddleware from '../../shared/middleware/verifyResource.middleware';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import ThresholdProfileController from './controllers/threshold-profile.controller';
import CopyThresholdProfileValidation from './middleware/copyThresholdProfile.validation';

const router = Router();
const controller = new ThresholdProfileController();

router.get(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('detectionMethod', ACCESS.READ),
  VerifyResourceMiddleware,
  controller.list,
);

router.post(
  '/:id/copy',
  AuthMiddleware,
  VerifyPermissionMiddleware('detectionMethod', ACCESS.WRITE),
  VerifyResourceMiddleware,
  CopyThresholdProfileValidation,
  controller.copy,
);

export default router;
