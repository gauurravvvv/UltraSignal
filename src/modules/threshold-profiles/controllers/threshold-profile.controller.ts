import { Request, Response } from 'express';
import copyThresholdProfile from './copyThresholdProfile';
import deleteThresholdProfile from './deleteThresholdProfile';
import getThresholdProfile from './getThresholdProfile';
import listThresholdProfile from './listThresholdProfile';
import updateThresholdProfile from './updateThresholdProfile';

class ThresholdProfileController {
  public list = async (req: Request, res: Response) => {
    listThresholdProfile(req, res);
  };

  public get = async (req: Request, res: Response) => {
    getThresholdProfile(req, res);
  };

  public copy = async (req: Request, res: Response) => {
    copyThresholdProfile(req, res);
  };

  public update = async (req: Request, res: Response) => {
    updateThresholdProfile(req, res);
  };

  public delete = async (req: Request, res: Response) => {
    deleteThresholdProfile(req, res);
  };
}

export default ThresholdProfileController;
