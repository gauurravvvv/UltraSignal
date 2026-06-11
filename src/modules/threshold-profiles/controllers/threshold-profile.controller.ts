import { Request, Response } from 'express';
import copyThresholdProfile from './copyThresholdProfile';
import listThresholdProfile from './listThresholdProfile';

class ThresholdProfileController {
  public list = async (req: Request, res: Response) => {
    listThresholdProfile(req, res);
  };

  public copy = async (req: Request, res: Response) => {
    copyThresholdProfile(req, res);
  };
}

export default ThresholdProfileController;
