/**
 * Product Group routes — mounted at /api/v1/product-groups.
 *
 *   GET / → paginated / filterable / sortable list. Optional
 *           `?includeMembers=true` to inline the member rows; default
 *           returns lean rows with `memberCount` only.
 *
 * Gated on `productGroup` READ. Future write/update/delete endpoints
 * will gate on WRITE / FULL respectively (see threshold-profiles for
 * the pattern).
 */
import { Router } from 'express';
import { ACCESS } from '../../shared/constants/permissions/access';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import VerifyResourceMiddleware from '../../shared/middleware/verifyResource.middleware';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import listProductGroup from './controllers/listProductGroup';
import ListProductGroupValidation from './middleware/listProductGroup.validation';

const router = Router();

router.get(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('productGroup', ACCESS.READ),
  VerifyResourceMiddleware,
  ListProductGroupValidation,
  listProductGroup,
);

export default router;
