/**
 * Threshold Profile routes — mounted at /api/v1/threshold-profiles.
 *
 *   GET    /          → paginated / filterable / sortable list
 *   GET    /:id       → detail (one profile + its conditions)
 *   PUT    /:id       → update metadata + (optional) wholesale-replace conditions
 *   DELETE /:id       → delete profile + cascade conditions
 *   POST   /:id/copy  → clone with new code/displayName + optional edited methods
 *
 * Gated on `detectionProfile` permission. READ for list / detail,
 * WRITE for update / copy, FULL for delete.
 *
 * System-scope rows (`scope.code === 'system'`) are immutable: PUT and
 * DELETE both 403 on them. List / GET still surface them with
 * `canEdit: false` / `canDelete: false`.
 */
import { Router } from 'express';
import { ACCESS } from '../../shared/constants/permissions/access';
import { idFromParam } from '../../shared/middleware/idFromParam.middleware';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import VerifyResourceMiddleware from '../../shared/middleware/verifyResource.middleware';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import ThresholdProfileController from './controllers/threshold-profile.controller';
import CopyThresholdProfileValidation from './middleware/copyThresholdProfile.validation';
import DeleteThresholdProfileValidation from './middleware/deleteThresholdProfile.validation';
import GetThresholdProfileValidation from './middleware/getThresholdProfile.validation';
import ListThresholdProfileValidation from './middleware/listThresholdProfile.validation';
import UpdateThresholdProfileValidation from './middleware/updateThresholdProfile.validation';

const router = Router();
const controller = new ThresholdProfileController();

router.get(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('detectionProfile', ACCESS.READ),
  VerifyResourceMiddleware,
  ListThresholdProfileValidation,
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

router.put(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('detectionProfile', ACCESS.WRITE),
  VerifyResourceMiddleware,
  idFromParam('id'),
  UpdateThresholdProfileValidation,
  controller.update,
);

router.delete(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('detectionProfile', ACCESS.FULL),
  VerifyResourceMiddleware,
  DeleteThresholdProfileValidation,
  controller.delete,
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
