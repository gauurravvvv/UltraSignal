/**
 * GroupController — thin bridge that binds Express route methods to handler functions.
 */
import { Request, Response } from 'express';
import addGroup from './addGroup';
import deleteGroup from './deleteGroup';
import deleteGroupBulk from './deleteGroupBulk';
import getGroup from './getGroup';
import listGroup from './listGroup';
import updateGroup from './updateGroup';

class GroupController {
  public add = async (req: Request, res: Response) => {
    addGroup(req, res);
  };

  public get = async (req: Request, res: Response) => {
    getGroup(req, res);
  };

  public update = async (req: Request, res: Response) => {
    updateGroup(req, res);
  };

  public delete = async (req: Request, res: Response) => {
    deleteGroup(req, res);
  };

  public deleteBulk = async (req: Request, res: Response) => {
    deleteGroupBulk(req, res);
  };

  public list = async (req: Request, res: Response) => {
    listGroup(req, res);
  };
}

export default GroupController;
