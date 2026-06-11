import { Request, Response } from 'express';
import listScope from './listScope';

class ScopeController {
  public list = async (req: Request, res: Response) => {
    listScope(req, res);
  };
}

export default ScopeController;
