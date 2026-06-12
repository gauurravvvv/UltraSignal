/**
 * Product Browser routes — mounted at /api/v1/product-browser.
 *
 *   GET  /  → search the catalog at a chosen hierarchy level
 *            (ingredient | family | product | trade), filtered by
 *            `sourceSystem` and matched ILIKE on the supplied
 *            `product` term.
 *
 * Gated on `productGroup` READ — the same permission that protects the
 * product-group screens. Tenants who can see product groups can also
 * search the underlying product browser catalog.
 */
import { Router } from 'express';
import { ACCESS } from '../../shared/constants/permissions/access';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import VerifyResourceMiddleware from '../../shared/middleware/verifyResource.middleware';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import ProductBrowserController from './controllers/product-browser.controller';
import ListProductBrowserValidation from './middleware/listProductBrowser.validation';

const router = Router();
const controller = new ProductBrowserController();

router.get(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('productGroup', ACCESS.READ),
  VerifyResourceMiddleware,
  ListProductBrowserValidation,
  controller.list,
);

export default router;
