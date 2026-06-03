import { Request, Response } from 'express';
import changePassword from './changePassword';
import getProfile from './getProfile';
import updateLocale from './updateLocale';

class ProfileController {
  public get = async (req: Request, res: Response) => {
    getProfile(req, res);
  };

  public changePassword = async (req: Request, res: Response) => {
    changePassword(req, res);
  };

  public updateLocale = async (req: Request, res: Response) => {
    updateLocale(req, res);
  };
}

export default ProfileController;
