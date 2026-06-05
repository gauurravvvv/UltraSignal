import { Request, Response } from 'express';
import getProduct from './getProduct';
import listProduct from './listProduct';

class ProductController {
  public list = async (req: Request, res: Response) => {
    listProduct(req, res);
  };
  public get = async (req: Request, res: Response) => {
    getProduct(req, res);
  };
}

export default ProductController;
