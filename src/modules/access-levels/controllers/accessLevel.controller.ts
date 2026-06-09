import { Request, Response } from 'express';
import listAccessLevels from './listAccessLevels';

class AccessLevelController {
  public list = async (req: Request, res: Response) => {
    listAccessLevels(req, res);
  };
}

export default AccessLevelController;
