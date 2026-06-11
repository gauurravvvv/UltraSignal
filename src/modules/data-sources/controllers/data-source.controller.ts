import { Request, Response } from 'express';
import addDataSource from './addDataSource';
import deleteDataSource from './deleteDataSource';
import getDataSource from './getDataSource';
import listDataSource from './listDataSource';
import testDataSourceConnection from './testDataSourceConnection';
import updateDataSource from './updateDataSource';

class DataSourceController {
  public add = async (req: Request, res: Response) => {
    addDataSource(req, res);
  };

  public list = async (req: Request, res: Response) => {
    listDataSource(req, res);
  };

  public get = async (req: Request, res: Response) => {
    getDataSource(req, res);
  };

  public update = async (req: Request, res: Response) => {
    updateDataSource(req, res);
  };

  public delete = async (req: Request, res: Response) => {
    deleteDataSource(req, res);
  };

  public testConnection = async (req: Request, res: Response) => {
    testDataSourceConnection(req, res);
  };
}

export default DataSourceController;
