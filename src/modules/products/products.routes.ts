/**
 * Product Browser routes — mounted at /api/v1/products.
 * Read-only — populated by ETL, not by API.
 *
 *  GET    /            list (paginated, filterable, searchable)
 *  GET    /:id         read one
 */
import { Router } from 'express';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import VerifyResourceMiddleware from '../../shared/middleware/verifyResource.middleware';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import ProductController from './controllers/product.controller';
import GetProductValidation from './middleware/getProduct.validation';
import ListProductValidation from './middleware/listProduct.validation';

const router = Router();
const controller = new ProductController();

router.get(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('productGroup'),
  VerifyResourceMiddleware,
  ListProductValidation,
  controller.list,
);

router.get(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('productGroup'),
  VerifyResourceMiddleware,
  GetProductValidation,
  controller.get,
);

export default router;
