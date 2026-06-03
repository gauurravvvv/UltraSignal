/**
 * Profile routes — mounted at /api/v1/profile. Singleton: the
 * "profile" is whoever is logged in, so there's no id in the path.
 *
 *  GET    /            read current user's profile
 *  PUT    /password    change password (subresource)
 *  PUT    /locale      change locale (subresource)
 */
import { Router } from 'express';
import VerifyResourceMiddleware from '../../shared/middleware/verifyResource.middleware';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import ProfileController from './controllers/profile.controller';
import ChangePasswordValidation from './middleware/changePassword.validation';
import UpdateLocaleValidation from './middleware/updateLocale.validation';

const router = Router();
const profileController = new ProfileController();

router.get('/', AuthMiddleware, profileController.get);

router.put(
  '/password',
  AuthMiddleware,
  ChangePasswordValidation,
  profileController.changePassword,
);

router.put(
  '/locale',
  AuthMiddleware,
  VerifyResourceMiddleware,
  UpdateLocaleValidation,
  profileController.updateLocale,
);

export default router;
