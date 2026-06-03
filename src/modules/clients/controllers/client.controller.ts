/**
 * ClientController — thin router-to-handler bridge for client operations.
 * No business logic lives here; each method delegates to its dedicated handler file.
 */
import { Request, Response } from 'express';
import addClient from './addClient';
import bulkDeleteClients from './bulkDeleteClients';
import deleteClient from './deleteClient';
import getClient from './getClient';
import listClient from './listClient';
import updateClient from './updateClient';

class ClientController {
  public add = async (req: Request, res: Response) => {
    addClient(req, res);
  };

  public get = async (req: Request, res: Response) => {
    getClient(req, res);
  };

  public update = async (req: Request, res: Response) => {
    updateClient(req, res);
  };

  public delete = async (req: Request, res: Response) => {
    deleteClient(req, res);
  };

  public deleteBulk = async (req: Request, res: Response) => {
    bulkDeleteClients(req, res);
  };

  public list = async (req: Request, res: Response) => {
    listClient(req, res);
  };
}

export default ClientController;
