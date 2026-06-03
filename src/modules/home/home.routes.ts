import { Router } from 'express';
import AuthMiddleware from '../auth/middleware/auth.middleware';
import HomeController from './controllers/home.controller';

const router = Router();

const homeController = new HomeController();

router.get('/system-admin', AuthMiddleware, homeController.systemAdmin);

export default router;
