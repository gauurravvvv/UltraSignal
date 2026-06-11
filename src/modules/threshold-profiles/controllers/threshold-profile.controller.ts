import { Request, Response } from 'express';
import listThresholdProfile from './listThresholdProfile';

class ThresholdProfileController {
  public list = async (req: Request, res: Response) => {
    listThresholdProfile(req, res);
  };
}

export default ThresholdProfileController;
