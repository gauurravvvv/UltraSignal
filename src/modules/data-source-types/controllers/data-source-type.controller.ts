import { Request, Response } from 'express';
import listDataSourceType from './listDataSourceType';

class DataSourceTypeController {
  public list = async (req: Request, res: Response) => {
    listDataSourceType(req, res);
  };
}

export default DataSourceTypeController;
