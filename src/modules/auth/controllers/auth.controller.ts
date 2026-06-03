/**
 * AuthController — thin router-to-handler bridge for all auth endpoints.
 * Each method delegates to its own dedicated file so files stay small
 * and focused. No business logic lives here.
 */
import { Request, Response } from 'express';
import login from './login';
import logoutHandler from './logout';
import refreshTokenHandler from './refreshToken';
import resendSetupLinkHandler from './resendSetupLink';
import resetPassword from './resetPassword';
import generateOTP from './sendResetPasswordOTP';
import setPasswordHandler from './setPassword';
import verifySetupTokenHandler from './verifySetupToken';

class AuthController {
  public login = async (req: Request, res: Response) => {
    login(req, res);
  };

  public logout = async (req: Request, res: Response) => {
    logoutHandler(req, res);
  };

  public refreshToken = async (req: Request, res: Response) => {
    refreshTokenHandler(req, res);
  };

  public getOTP = async (req: Request, res: Response) => {
    generateOTP(req, res);
  };

  public reset = async (req: Request, res: Response) => {
    resetPassword(req, res);
  };

  public setPassword = async (req: Request, res: Response) => {
    setPasswordHandler(req, res);
  };

  public verifySetupToken = async (req: Request, res: Response) => {
    verifySetupTokenHandler(req, res);
  };

  public resendSetupLink = async (req: Request, res: Response) => {
    resendSetupLinkHandler(req, res);
  };
}

export default AuthController;
