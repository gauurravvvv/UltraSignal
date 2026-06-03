/**
 * updateOrgUserPassword — resets a user's password with history enforcement and
 * session invalidation.
 *
 * The password-history check runs outside the transaction because it is
 * read-only — rejecting a reused password before opening a write transaction
 * avoids taking a lock for a request that will be rejected anyway.
 *
 * Nulling `refreshToken` and `refreshTokenExpiresAt` after a password reset
 * invalidates any active sessions, forcing re-authentication with the new
 * credential. Without this, a compromised account remains accessible via an
 * existing refresh token even after an admin resets the password.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  AUTH as AUTH_MSG,
  GENERIC,
  USER as USER_MSG,
} from '../../../shared/constants/response.messages';
import { User } from '../../../shared/db/entities/user.entity';
import { encryptForClient } from '../../../shared/services/crypto.service';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import {
  isPasswordReusedShared,
  savePasswordHistoryShared,
} from '../../../shared/utility/passwordHistory';
import sendResponse from '../../../shared/utility/response';
import { AppDataSource } from '../../../shared/db';

const updateOrgUserPassword = async (req: Request, res: Response) => {
  Logger.info(`Update user password request`);

  const { newPassword } = req.body;
  const { loggedInId, clientData, orgUser } = res.locals;

  try {
    const isReused = await isPasswordReusedShared(
      AppDataSource.manager,
      orgUser.id,
      newPassword,
      clientData.config.encryptionAlgorithm,
      clientData.config.pepperKey,
      orgUser.password,
    );
    if (isReused) {
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        AUTH_MSG.PASSWORD_REUSED,
      );
    }

    orgUser.password = encryptForClient(newPassword, clientData.config);
    orgUser.updatedBy = loggedInId;
    orgUser.refreshToken = null;
    orgUser.refreshTokenExpiresAt = null;

    let result!: User;
    await AppDataSource.manager.transaction(
      async (manager: EntityManager) => {
        result = await manager.getRepository(User).save(orgUser);
        await savePasswordHistoryShared(manager, orgUser.id, orgUser.password);
      },
    );

    sendResponse(res, true, CODE.SUCCESS, USER_MSG.PASSWORD_UPDATED, result);
  } catch (error) {
    Logger.error(`Error while updating password: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default updateOrgUserPassword;
