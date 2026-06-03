/**
 * DeleteUserValidation — guards against self-deletion and default-user deletion
 * before the controller runs.
 *
 * Both rules apply to every caller who reaches this route. The previous
 * SYSTEM-ADMIN bypass existed so the platform admin could nuke a default
 * user during client decommissioning; that path now lives under
 * `DELETE /clients/:id` (which cascades) — system admins can no longer reach
 * this route at all (no userManagement permission in the V2 set), so the
 * bypass became dead code and is removed for consistency.
 */
import { NextFunction, Request, Response } from 'express';
import {
  CODE,
  IS_DEFAULT,
  VALIDATION_MESSAGES,
} from '../../../../config/config';
import {
  CLIENT,
  USER as USER_MSG,
} from '../../../shared/constants/response.messages';
import { User } from '../../../shared/db/entities/user.entity';
import sendResponse from '../../../shared/utility/response';
import { AppDataSource } from '../../../shared/db';

const DeleteUserValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { loggedInId, clientData } = res.locals;
  const { id } = req.params;

  if (!id) {
    return sendResponse(
      res,
      false,
      CODE.BAD_REQUEST,
      VALIDATION_MESSAGES.ID.REQUIRED,
    );
  }

  if (loggedInId == id) {
    return sendResponse(
      res,
      false,
      CODE.BAD_REQUEST,
      'You cannot delete yourself',
    );
  }

  try {
    const orgUser = await AppDataSource.getRepository(User).findOne({
      where: { id, clientId: clientData.id },
    });

    if (!orgUser) {
      return sendResponse(res, false, CODE.NOT_FOUND, USER_MSG.NOT_FOUND);
    }

    if (orgUser.isDefault === IS_DEFAULT.YES) {
      return sendResponse(
        res,
        false,
        CODE.UNAUTHORIZED,
        USER_MSG.CANNOT_DELETE_DEFAULT,
      );
    }

    res.locals.orgUser = orgUser;
  } catch (err) {
    return sendResponse(res, false, CODE.BAD_REQUEST, CLIENT.INVALID_ID);
  }

  next();
};

export default DeleteUserValidation;
