/**
 * ProductGroupController — thin bridge from Express to handler functions.
 */
import { Request, Response } from 'express';
import addProductGroup from './addProductGroup';
import bulkDeleteProductGroup from './bulkDeleteProductGroup';
import deleteProductGroup from './deleteProductGroup';
import getProductGroup from './getProductGroup';
import listProductGroup from './listProductGroup';
import updateProductGroup from './updateProductGroup';

class ProductGroupController {
  public add = async (req: Request, res: Response) => {
    addProductGroup(req, res);
  };

  public get = async (req: Request, res: Response) => {
    getProductGroup(req, res);
  };

  public update = async (req: Request, res: Response) => {
    updateProductGroup(req, res);
  };

  public delete = async (req: Request, res: Response) => {
    deleteProductGroup(req, res);
  };

  public deleteBulk = async (req: Request, res: Response) => {
    bulkDeleteProductGroup(req, res);
  };

  public list = async (req: Request, res: Response) => {
    listProductGroup(req, res);
  };
}

export default ProductGroupController;
