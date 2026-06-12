/**
 * Product Browser routes — mounted at /api/v1/product-browser.
 *
 *   POST  /search  → search the catalog at a chosen hierarchy level
 *                    (INGREDIENT | PRODUCT_FAMILY | PRODUCT_NAME |
 *                    TRADE_NAME | ALL), filtered by `sourceSystem` and
 *                    matched ILIKE on the supplied `searchedValue`.
 *
 * POST (not GET) mirrors the UAN `getProductData` contract — the FE
 * sends the criteria in a JSON body. Gated on `productGroup` READ —
 * the same permission that protects the product-group screens.
 */
import { Router } from 'express';
import { ACCESS } from '../../shared/constants/permissions/access';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import VerifyResourceMiddleware from '../../shared/middleware/verifyResource.middleware';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import ProductBrowserController from './controllers/product-browser.controller';
import SearchProductBrowserValidation from './middleware/listProductBrowser.validation';

const router = Router();
const controller = new ProductBrowserController();

router.post(
  '/search',
  AuthMiddleware,
  VerifyPermissionMiddleware('productGroup', ACCESS.READ),
  VerifyResourceMiddleware,
  SearchProductBrowserValidation,
  controller.search,
);

export default router;
