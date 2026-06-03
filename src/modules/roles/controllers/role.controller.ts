/**
 * RoleController — thin bridge that binds Express route methods to handler functions.
 */
import { Request, Response } from 'express';
import addRole from './addRole';
import deleteRole from './deleteRole';
import deleteRoleBulk from './deleteRoleBulk';
import getRole from './getRole';
import listPermissions from './listPermissions';
import listRole from './listRole';
import updateRole from './updateRole';

class RoleController {
  public add = async (req: Request, res: Response) => {
    addRole(req, res);
  };

  public list = async (req: Request, res: Response) => {
    listRole(req, res);
  };

  public get = async (req: Request, res: Response) => {
    getRole(req, res);
  };

  public update = async (req: Request, res: Response) => {
    updateRole(req, res);
  };

  public delete = async (req: Request, res: Response) => {
    deleteRole(req, res);
  };

  public deleteBulk = async (req: Request, res: Response) => {
    deleteRoleBulk(req, res);
  };

  public permissions = async (req: Request, res: Response) => {
    listPermissions(req, res);
  };
}

export default RoleController;
