/**
 * Organisation routes — mounted at /api/v1/orgs. Every endpoint
 * requires the `orgManagement` permission, which today is held
 * only by the seeded System Admin role. Org admins and org users
 * have no `orgManagement` permission on their roles, so they get
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
import OrganisationController from './controllers/organisation.controller';
import AddOrganisationValidation from './middleware/addOrganisation.validation';
import DeleteOrganisationValidation from './middleware/deleteOrganisation.validation';
import DeleteOrganisationBulkValidation from './middleware/deleteOrganisationBulk.validation';
import GetOrganisationValidation from './middleware/getOrganisation.validation';
import ListOrganisationValidation from './middleware/listOrganisation.validation';
import UpdateOrganisationValidation from './middleware/updateOrganisation.validation';

const router = Router();
const orgController = new OrganisationController();

const requireOrgManagement = VerifyPermissionMiddleware('orgManagement');

router.post(
  '/',
  AuthMiddleware,
  requireOrgManagement,
  AddOrganisationValidation,
  orgController.add,
);

router.get(
  '/',
  AuthMiddleware,
  requireOrgManagement,
  ListOrganisationValidation,
  orgController.list,
);

router.post(
  '/bulk-delete',
  AuthMiddleware,
  requireOrgManagement,
  DeleteOrganisationBulkValidation,
  orgController.deleteBulk,
);

router.get(
  '/:id',
  AuthMiddleware,
  requireOrgManagement,
  GetOrganisationValidation,
  orgController.get,
);

router.put(
  '/:id',
  AuthMiddleware,
  requireOrgManagement,
  idFromParam('id'),
  UpdateOrganisationValidation,
  orgController.update,
);

router.delete(
  '/:id',
  AuthMiddleware,
  requireOrgManagement,
  DeleteOrganisationValidation,
  orgController.delete,
);

export default router;
