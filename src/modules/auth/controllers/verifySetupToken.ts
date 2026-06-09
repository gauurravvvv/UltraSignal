/**
 * verifySetupToken — pre-flight check before the password setup form is rendered.
 *
 * Returns status 200 in all cases (success: true) with a tokenStatus payload
 * rather than HTTP error codes. The frontend uses the tokenStatus string
 * ('valid' | 'invalid') to decide which UI state to show.
 *
 * Token-status is intentionally binary to avoid leaking user-existence to an
 * unauthenticated caller. Does NOT modify any data — read-only token check only.
 */
import { timingSafeEqual } from 'crypto';
import { Request, Response } from 'express';
import { CODE, STATUS } from '../../../../config/config';
import {
  AUTH as AUTH_MSG,
  GENERIC,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { Client } from '../../../shared/db/entities/client.entity';
import { User } from '../../../shared/db/entities/user.entity';
import { decryptForClient } from '../../../shared/services/crypto.service';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const respondInvalid = (res: Response) =>
  sendResponse(res, true, CODE.SUCCESS, AUTH_MSG.SETUP_TOKEN_VERIFIED, {
    tokenStatus: 'invalid',
  });

const verifySetupToken = async (req: Request, res: Response) => {
  Logger.info(`Verify setup token request`);

  const { id, clientId, token } = req.body;

  try {
    const client = await Client.findOne({
      where: { id: clientId },
      relations: ['config'],
    });

    if (!client) {
      return respondInvalid(res);
    }

    const user = await AppDataSource.getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.setupToken')
      .addSelect('user.setupTokenExpiresAt')
      .addSelect('user.password')
      .where('user.id = :id', { id })
      .andWhere('user.clientId = :clientId', { clientId })
      .getOne();

    if (
      !user ||
      user.status === STATUS.INACTIVE ||
      user.password ||
      !user.setupToken
    ) {
      return respondInvalid(res);
    }

    if (
      user.setupTokenExpiresAt &&
      new Date() > new Date(user.setupTokenExpiresAt)
    ) {
      return respondInvalid(res);
    }

    const decryptedToken = decryptForClient(user.setupToken);
    if (!timingSafeEqual(Buffer.from(token), Buffer.from(decryptedToken))) {
      return respondInvalid(res);
    }

    return sendResponse(res, true, CODE.SUCCESS, AUTH_MSG.SETUP_TOKEN_VALID, {
      tokenStatus: 'valid',
    });
  } catch (error) {
    Logger.error(`Error in verifySetupToken: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default verifySetupToken;
