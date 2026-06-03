/**
 * OrganisationController — thin router-to-handler bridge for organisation operations.
 * No business logic lives here; each method delegates to its dedicated handler file.
 */
import { Request, Response } from 'express';
import addOrg from './addOrg';
import deleteOrg from './deleteOrg';
import deleteOrgBulk from './deleteOrgBulk';
import getOrg from './getOrg';
import listOrganisation from './listOrg';
import updateOrg from './updateOrg';

class OrganisationController {
  public add = async (req: Request, res: Response) => {
    addOrg(req, res);
  };

  public get = async (req: Request, res: Response) => {
    getOrg(req, res);
  };

  public update = async (req: Request, res: Response) => {
    updateOrg(req, res);
  };

  public delete = async (req: Request, res: Response) => {
    deleteOrg(req, res);
  };

  public deleteBulk = async (req: Request, res: Response) => {
    deleteOrgBulk(req, res);
  };

  public list = async (req: Request, res: Response) => {
    listOrganisation(req, res);
  };
}

export default OrganisationController;
