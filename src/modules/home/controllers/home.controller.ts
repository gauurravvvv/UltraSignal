import { Request, Response } from 'express';
import systemAdminHome from './systemAdminHome';

class HomeController {
  public systemAdmin = async (req: Request, res: Response) => {
    systemAdminHome(req, res);
  };
}

export default HomeController;
