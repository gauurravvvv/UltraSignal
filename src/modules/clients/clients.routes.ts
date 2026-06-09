/**
 * Client routes — mounted at /api/v1/clients.
 *
 * Permission required: `clientManagement` (held only by the seeded System
 * Admin role). Per-client users have no `clientManagement` permission
 * so they get a clean 401 here before validation runs.
 *
 * Level mapping:
 *   GET           → READ
 *   POST / PUT    → WRITE
 *   DELETE        → FULL
 *   bulk-delete   → FULL
 *
 * /bulk-delete must be registered BEFORE /:id so Express doesn't
 * interpret 'bulk-delete' as an id.
 */
import { Router } from 'express';
import { idFromParam } from '../../shared/middleware/idFromParam.middleware';
import VerifyPermissionMiddleware from '../../shared/middleware/verifyPermission.middleware';
import { ACCESS } from '../../shared/constants/permissions/access';
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

router.post(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('clientManagement', ACCESS.WRITE),
  AddClientValidation,
  clientController.add,
);

router.get(
  '/',
  AuthMiddleware,
  VerifyPermissionMiddleware('clientManagement', ACCESS.READ),
  ListClientValidation,
  clientController.list,
);

router.post(
  '/bulk-delete',
  AuthMiddleware,
  VerifyPermissionMiddleware('clientManagement', ACCESS.FULL),
  BulkDeleteClientsValidation,
  clientController.deleteBulk,
);

router.get(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('clientManagement', ACCESS.READ),
  GetClientValidation,
  clientController.get,
);

router.put(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('clientManagement', ACCESS.WRITE),
  idFromParam('id'),
  UpdateClientValidation,
  clientController.update,
);

router.delete(
  '/:id',
  AuthMiddleware,
  VerifyPermissionMiddleware('clientManagement', ACCESS.FULL),
  DeleteClientValidation,
  clientController.delete,
);

export default router;
