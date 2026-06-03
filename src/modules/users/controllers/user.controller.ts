/**
 * UserController — thin bridge between Express routes and single-action handlers.
 * Each method forwards to its own module; no logic lives here.
 */
import { Request, Response } from 'express';
import addUser from './addUser';
import bulkAddUserCommit from './bulkAddUserCommit';
import bulkAddUserValidate from './bulkAddUserValidate';
import deleteUser from './deleteUser';
import deleteUserBulk from './deleteUserBulk';
import getUser from './getUser';
import listUser from './listUser';
import unlockUser from './unlockUser';
import updateUser from './updateUser';
import updateOrgUserPassword from './updateUserPassword';

class UserController {
  public add = async (req: Request, res: Response) => {
    addUser(req, res);
  };

  public bulkAddValidate = async (req: Request, res: Response) => {
    bulkAddUserValidate(req, res);
  };

  public bulkAddCommit = async (req: Request, res: Response) => {
    bulkAddUserCommit(req, res);
  };

  public get = async (req: Request, res: Response) => {
    getUser(req, res);
  };

  public update = async (req: Request, res: Response) => {
    updateUser(req, res);
  };

  public delete = async (req: Request, res: Response) => {
    deleteUser(req, res);
  };

  public deleteBulk = async (req: Request, res: Response) => {
    deleteUserBulk(req, res);
  };

  public list = async (req: Request, res: Response) => {
    listUser(req, res);
  };

  public updatePassord = async (req: Request, res: Response) => {
    updateOrgUserPassword(req, res);
  };

  public unlock = async (req: Request, res: Response) => {
    unlockUser(req, res);
  };
}

export default UserController;
