import { Request, Response } from 'express';
import searchProductBrowser from './listProductBrowser';

class ProductBrowserController {
  public search = async (req: Request, res: Response) => {
    searchProductBrowser(req, res);
  };
}

export default ProductBrowserController;
