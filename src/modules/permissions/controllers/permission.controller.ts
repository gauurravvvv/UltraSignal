import { Request, Response } from 'express';
import listPermissions from './listPermissions';

class PermissionController {
  public list = async (req: Request, res: Response) => {
    listPermissions(req, res);
  };
}

export default PermissionController;
