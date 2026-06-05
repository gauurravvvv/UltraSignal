/**
 * Product Group routes — mounted at /api/v1/product-groups.
 * All endpoints require the `productGroup` permission.
 *
 *  POST   /                       create
 *  GET    /                       list
 *  GET    /:id                    read one (with members)
 *  PUT    /:id                    update (metadata + replace members)
 *  DELETE /:id                    delete (soft)
 *  POST   /bulk-delete            bulk delete
 */
import { Router } from 'express';
import { idFromParam } from '../../shared/middleware/idFromParam.middleware';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import VerifyResourceMiddleware from '../../shared/middleware/verifyResource.middleware';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import ProductGroupController from './controllers/productGroup.controller';
import AddProductGroupValidation from './middleware/addProductGroup.validation';
import BulkDeleteProductGroupValidation from './middleware/bulkDeleteProductGroup.validation';
import DeleteProductGroupValidation from './middleware/deleteProductGroup.validation';
import GetProductGroupValidation from './middleware/getProductGroup.validation';
import ListProductGroupValidation from './middleware/listProductGroup.validation';
import UpdateProductGroupValidation from './middleware/updateProductGroup.validation';

const router = Router();
const controller = new ProductGroupController();

router.post(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('productGroup'),
  VerifyResourceMiddleware,
  AddProductGroupValidation,
  controller.add,
);

router.get(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('productGroup'),
  VerifyResourceMiddleware,
  ListProductGroupValidation,
  controller.list,
);

router.get(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('productGroup'),
  VerifyResourceMiddleware,
  GetProductGroupValidation,
  controller.get,
);

router.put(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('productGroup'),
  VerifyResourceMiddleware,
  idFromParam('id'),
  UpdateProductGroupValidation,
  controller.update,
);

router.delete(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('productGroup'),
  VerifyResourceMiddleware,
  DeleteProductGroupValidation,
  controller.delete,
);

router.post(
  '/bulk-delete',
  AuthMiddleware,
  VerifyPermissionMiddleware('productGroup'),
  VerifyResourceMiddleware,
  BulkDeleteProductGroupValidation,
  controller.deleteBulk,
);

export default router;
