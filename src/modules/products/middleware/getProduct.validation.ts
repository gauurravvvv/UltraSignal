import { NextFunction, Request, Response } from 'express';
import { CODE, VALIDATION_MESSAGES } from '../../../../config/config';
import sendResponse from '../../../shared/utility/response';

const GetProductValidation = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { id } = req.params;
  if (!id) {
    return sendResponse(
      res,
      false,
      CODE.BAD_REQUEST,
      VALIDATION_MESSAGES.ID.REQUIRED + ' for product',
    );
  }
  next();
};

export default GetProductValidation;
