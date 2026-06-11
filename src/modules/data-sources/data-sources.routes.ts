/**
 * Data Source routes — mounted at /api/v1/data-sources.
 *
 * Permission required: `dataSource` (the catalog row under Business
 * Configuration), with level depending on the verb:
 *   GET           → READ
 *   POST / PUT    → WRITE
 *   DELETE        → FULL
 */
import { Router } from 'express';
import { ACCESS } from '../../shared/constants/permissions/access';
import { idFromParam } from '../../shared/middleware/idFromParam.middleware';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import VerifyResourceMiddleware from '../../shared/middleware/verifyResource.middleware';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import DataSourceController from './controllers/data-source.controller';
import AddDataSourceValidation from './middleware/addDataSource.validation';
import DeleteDataSourceValidation from './middleware/deleteDataSource.validation';
import GetDataSourceValidation from './middleware/getDataSource.validation';
import ListDataSourceValidation from './middleware/listDataSource.validation';
import UpdateDataSourceValidation from './middleware/updateDataSource.validation';

const router = Router();
const controller = new DataSourceController();

router.post(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('dataSource', ACCESS.WRITE),
  VerifyResourceMiddleware,
  AddDataSourceValidation,
  controller.add,
);

router.get(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('dataSource', ACCESS.READ),
  VerifyResourceMiddleware,
  ListDataSourceValidation,
  controller.list,
);

router.get(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('dataSource', ACCESS.READ),
  VerifyResourceMiddleware,
  GetDataSourceValidation,
  controller.get,
);

router.put(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('dataSource', ACCESS.WRITE),
  VerifyResourceMiddleware,
  idFromParam('id'),
  UpdateDataSourceValidation,
  controller.update,
);

router.delete(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('dataSource', ACCESS.FULL),
  VerifyResourceMiddleware,
  DeleteDataSourceValidation,
  controller.delete,
);

export default router;
