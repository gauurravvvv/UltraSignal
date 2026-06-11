/**
 * Threshold Profile routes — mounted at /api/v1/threshold-profiles.
 *
 *   GET   /          → list every threshold profile with its conditions inline
 *   GET   /:id       → detail (one profile + its conditions) — used by
 *                      the FE to prefill the Copy / Detail screen
 *   POST  /:id/copy  → clone a profile (and all its conditions) under a
 *                      new code + displayName supplied in the body
 *
 * Gated on `detectionProfile` permission. READ for the list / detail,
 * WRITE for the copy.
 */
import { Router } from 'express';
import { ACCESS } from '../../shared/constants/permissions/access';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import VerifyResourceMiddleware from '../../shared/middleware/verifyResource.middleware';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import ThresholdProfileController from './controllers/threshold-profile.controller';
import CopyThresholdProfileValidation from './middleware/copyThresholdProfile.validation';
import GetThresholdProfileValidation from './middleware/getThresholdProfile.validation';

const router = Router();
const controller = new ThresholdProfileController();

router.get(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('detectionProfile', ACCESS.READ),
  VerifyResourceMiddleware,
  controller.list,
);

router.get(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('detectionProfile', ACCESS.READ),
  VerifyResourceMiddleware,
  GetThresholdProfileValidation,
  controller.get,
);

router.post(
  '/:id/copy',
  AuthMiddleware,
  VerifyPermissionMiddleware('detectionProfile', ACCESS.WRITE),
  VerifyResourceMiddleware,
  CopyThresholdProfileValidation,
  controller.copy,
);

export default router;
