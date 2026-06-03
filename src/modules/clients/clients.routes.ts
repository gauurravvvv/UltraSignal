/**
 * Client routes — mounted at /api/v1/clients. Every endpoint
 * requires the `clientManagement` permission, which today is held
 * only by the seeded System Admin role. Client admins and client users
 * have no `clientManagement` permission on their roles, so they get
 * a clean 401 from VerifyPermissionMiddleware before validation
 * runs.
 *
 *  POST   /                          create
 *  GET    /                          list
 *  GET    /:id                       read one
 *  PUT    /:id                       update
 *  DELETE /:id                       delete
 *  POST   /bulk-delete               bulk delete
 *
 * /bulk-delete must be registered BEFORE /:id so Express doesn't
 * interpret 'bulk-delete' as an id.
 */
import { Router } from 'express';
import { idFromParam } from '../../shared/middleware/idFromParam.middleware';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import ClientController from './controllers/client.controller';
import AddClientValidation from './middleware/addClient.validation';
import BulkDeleteClientsValidation from './middleware/bulkDeleteClients.validation';
import DeleteClientValidation from './middleware/deleteClient.validation';
import GetClientValidation from './middleware/getClient.validation';
import ListClientValidation from './middleware/listClient.validation';
import UpdateClientValidation from './middleware/updateClient.validation';

const router = Router();
const clientController = new ClientController();

const requireClientManagement = VerifyPermissionMiddleware('clientManagement');

router.post(
  '/',
  AuthMiddleware,
  requireClientManagement,
  AddClientValidation,
  clientController.add,
);

router.get(
  '/',
  AuthMiddleware,
  requireClientManagement,
  ListClientValidation,
  clientController.list,
);

router.post(
  '/bulk-delete',
  AuthMiddleware,
  requireClientManagement,
  BulkDeleteClientsValidation,
  clientController.deleteBulk,
);

router.get(
  '/:id',
  AuthMiddleware,
  requireClientManagement,
  GetClientValidation,
  clientController.get,
);

router.put(
  '/:id',
  AuthMiddleware,
  requireClientManagement,
  idFromParam('id'),
  UpdateClientValidation,
  clientController.update,
);

router.delete(
  '/:id',
  AuthMiddleware,
  requireClientManagement,
  DeleteClientValidation,
  clientController.delete,
);

export default router;
