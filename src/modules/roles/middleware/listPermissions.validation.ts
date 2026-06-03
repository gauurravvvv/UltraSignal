/**
 * ListPermissionsValidation — pass-through middleware for the permissions endpoint.
 *
 * No validation is needed because permissions are loaded from static constants by
 * VerifyResourceMiddleware based on the JWT role — there are no user-supplied params
 * to validate. The middleware exists as a slot in the chain in case request-level
 * validation needs to be added later (e.g., role-specific permission filtering).
 */
import { NextFunction, Request, Response } from 'express';

const ListPermissionsValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  next();
};

export default ListPermissionsValidation;
