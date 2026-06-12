import { Request, Response } from 'express';
import listProductBrowser from './listProductBrowser';

class ProductBrowserController {
  public list = async (req: Request, res: Response) => {
    listProductBrowser(req, res);
  };
}

export default ProductBrowserController;
