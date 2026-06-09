/**
 * Auth Routes — /api/v1/auth
 *
 * Handles all authentication flows: login/logout, token refresh,
 * password lifecycle (set, reset via OTP), account setup via email
 * link.
 *
 * Public routes (no AuthMiddleware): login, refresh, generateOTP, reset,
 * set-password, verify-setup-token, resend-setup-link.
 * Protected routes (require valid JWT): logout, session.
 */
import { Router } from 'express';
import AuthController from './controllers/auth.controller';
import AuthMiddleware from './middleware/auth.middleware';
import GetOtpValidation from './middleware/generateOTP.validation';
import LoginValidation from './middleware/login.validation';
import RefreshTokenValidation from './middleware/refreshToken.validation';
import ResendSetupLinkValidation from './middleware/resendSetupLink.validation';
import ResetPasswordValidation from './middleware/resetPassword.validation';
import SetPasswordValidation from './middleware/setPassword.validation';
import VerifySetupTokenValidation from './middleware/verifySetupToken.validation';

const router = Router();

const authController = new AuthController();

// Standard login — validates credentials, returns access + refresh tokens
router.post('/login', LoginValidation, authController.login);

// Phase-2 session bootstrap — returns the full payload the FE needs to
// render the app shell (permissions, role, inactivity timeout, and
// theme/branding/announcements placeholders). Called by Relay.
router.get('/session', AuthMiddleware, authController.getSession);

// Invalidates the refresh token stored in DB, ending the session
router.post('/logout', AuthMiddleware, authController.logout);

// Issues a new access token when the old one expires; refresh token is validated from DB
router.post('/refresh', RefreshTokenValidation, authController.refreshToken);

// Sends a time-limited OTP to the user's email to begin password reset
router.post('/generate-otp', GetOtpValidation, authController.getOTP);

// Validates the OTP and sets a new password; clears refresh tokens to force re-login
router.post('/reset', ResetPasswordValidation, authController.reset);

// Completes first-time account setup; the 64-char hex token comes from the welcome email
router.post('/set-password', SetPasswordValidation, authController.setPassword);

// Pre-flight check: tells the UI whether the setup token is valid/expired/already used
// before showing the password form — avoids a confusing UX after a bad form submit
router.post(
  '/verify-setup-token',
  VerifySetupTokenValidation,
  authController.verifySetupToken,
);

// Admin-triggered: generates a fresh setup link and re-sends the welcome email
router.post(
  '/resend-setup-link',
  ResendSetupLinkValidation,
  authController.resendSetupLink,
);

export default router;
