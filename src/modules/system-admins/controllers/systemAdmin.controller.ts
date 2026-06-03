/**
 * SystemAdminController — thin router-to-handler bridge for system admin operations.
 *
 * Each public method delegates immediately to its dedicated handler file.
 * No business logic lives here — this class exists solely because Express
 * routes are registered with method references (controller.add) rather than
 * plain function imports.
 */
import { Request, Response } from 'express';
import addSystemAdmin from './addSystemAdmin';
import deleteSystemAdmin from './deleteSystemAdmin';
import deleteSystemAdminBulk from './deleteSystemAdminBulk';
import getSystemAdmin from './getSystemAdmin';
import listSystemAdmin from './listSystemAdmin';
import unlockSystemAdmin from './unlockSystemAdmin';
import updateSystemAdmin from './updateSystemAdmin';
import updateSystemAdminPassword from './updateSystemAdminPassword';

class SystemAdminController {
  public add = async (req: Request, res: Response) => {
    addSystemAdmin(req, res);
  };

  public get = async (req: Request, res: Response) => {
    getSystemAdmin(req, res);
  };

  public update = async (req: Request, res: Response) => {
    updateSystemAdmin(req, res);
  };

  public delete = async (req: Request, res: Response) => {
    deleteSystemAdmin(req, res);
  };

  public deleteBulk = async (req: Request, res: Response) => {
    deleteSystemAdminBulk(req, res);
  };

  public list = async (req: Request, res: Response) => {
    listSystemAdmin(req, res);
  };

  public updatePassword = async (req: Request, res: Response) => {
    updateSystemAdminPassword(req, res);
  };

  public unlock = async (req: Request, res: Response) => {
    unlockSystemAdmin(req, res);
  };
}

export default SystemAdminController;
