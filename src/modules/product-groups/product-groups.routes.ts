/**
 * Product Group routes — mounted at /api/v1/product-groups.
 *
 *   GET    /        → paginated / filterable / sortable list. Optional
 *                     `?includeMembers=true` to inline member rows;
 *                     default returns lean rows with `memberCount`
 *                     only.
 *   POST   /        → create a new group + its members atomically.
 *   GET    /:id     → single group + its members (read-only fetch
 *                     used by View / Edit screens).
 *   PUT    /:id     → update name / description / status + wholesale-
 *                     replace members.
 *   DELETE /:id     → soft-delete the group (and implicitly its
 *                     members, since list / get filter by parent).
 *
 * Permission gating:
 *   - READ  → list, get
 *   - WRITE → create, update
 *   - FULL  → delete
 *
 * Future bulk-delete endpoint slots in cleanly here.
 */
import { Router } from 'express';
import { ACCESS } from '../../shared/constants/permissions/access';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import VerifyResourceMiddleware from '../../shared/middleware/verifyResource.middleware';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import addProductGroup from './controllers/addProductGroup';
import deleteProductGroup from './controllers/deleteProductGroup';
import getProductGroup from './controllers/getProductGroup';
import listProductGroup from './controllers/listProductGroup';
import updateProductGroup from './controllers/updateProductGroup';
import AddProductGroupValidation from './middleware/addProductGroup.validation';
import DeleteProductGroupValidation from './middleware/deleteProductGroup.validation';
import GetProductGroupValidation from './middleware/getProductGroup.validation';
import ListProductGroupValidation from './middleware/listProductGroup.validation';
import UpdateProductGroupValidation from './middleware/updateProductGroup.validation';

const router = Router();

router.get(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('productGroup', ACCESS.READ),
  VerifyResourceMiddleware,
  ListProductGroupValidation,
  listProductGroup,
);

router.post(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('productGroup', ACCESS.WRITE),
  VerifyResourceMiddleware,
  AddProductGroupValidation,
  addProductGroup,
);

router.get(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('productGroup', ACCESS.READ),
  VerifyResourceMiddleware,
  GetProductGroupValidation,
  getProductGroup,
);

router.put(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('productGroup', ACCESS.WRITE),
  VerifyResourceMiddleware,
  UpdateProductGroupValidation,
  updateProductGroup,
);

router.delete(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('productGroup', ACCESS.FULL),
  VerifyResourceMiddleware,
  DeleteProductGroupValidation,
  deleteProductGroup,
);

export default router;
