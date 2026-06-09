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

  // Log shape of inputs (NEVER log the plaintext token — it would
  // otherwise show up in production log aggregators).
  Logger.debug(
    `verifySetupToken inputs: id=${id} clientId=${clientId} tokenLen=${(token ?? '').length}`,
  );

  try {
    const client = await Client.findOne({
      where: { id: clientId },
      relations: ['config'],
    });

    if (!client) {
      Logger.warn(
        `verifySetupToken: client ${clientId} not found → returning invalid`,
      );
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

    if (!user) {
      Logger.warn(
        `verifySetupToken: user ${id} not found in client ${clientId} → returning invalid`,
      );
      return respondInvalid(res);
    }
    if (user.status === STATUS.INACTIVE) {
      Logger.warn(
        `verifySetupToken: user ${id} is INACTIVE → returning invalid`,
      );
      return respondInvalid(res);
    }
    if (user.password) {
      Logger.warn(
        `verifySetupToken: user ${id} already has password (setup completed) → returning invalid`,
      );
      return respondInvalid(res);
    }
    if (!user.setupToken) {
      Logger.warn(
        `verifySetupToken: user ${id} has no setupToken on file → returning invalid`,
      );
      return respondInvalid(res);
    }

    if (
      user.setupTokenExpiresAt &&
      new Date() > new Date(user.setupTokenExpiresAt)
    ) {
      Logger.warn(
        `verifySetupToken: user ${id} setupToken expired at ${user.setupTokenExpiresAt.toISOString?.() ?? user.setupTokenExpiresAt} → returning invalid`,
      );
      return respondInvalid(res);
    }

    // Inspect the stored ciphertext shape WITHOUT logging the value
    // itself. A healthy value is `v1:<32-hex>:<32-hex>:<64-hex>` ≈ 134 chars.
    const stored = user.setupToken;
    const parts = stored.split(':');
    Logger.debug(
      `verifySetupToken: stored token shape — length=${stored.length} ` +
        `parts=${parts.length} versionPrefix=${parts[0] ?? '<empty>'}`,
    );

    let decryptedToken: string;
    try {
      decryptedToken = decryptForClient(stored);
    } catch (decryptErr) {
      Logger.error(
        `verifySetupToken: decrypt failed for user ${id} ` +
          `(${getErrorMessage(decryptErr)}). ` +
          `Likely cause: stored token was encrypted under the old per-client ` +
          `DEK scheme and the new master-key-only crypto can't open it. ` +
          `Fix: resend the setup link for this user.`,
      );
      return respondInvalid(res);
    }

    Logger.debug(
      `verifySetupToken: decrypt OK — decryptedLen=${decryptedToken.length} ` +
        `incomingLen=${(token ?? '').length}`,
    );

    // timingSafeEqual REQUIRES equal-length buffers; otherwise it throws.
    // Length-check first so we can produce a useful log line and avoid
    // turning a benign mismatch into an uncaught exception.
    if (
      typeof token !== 'string' ||
      token.length !== decryptedToken.length
    ) {
      Logger.warn(
        `verifySetupToken: token length mismatch for user ${id} ` +
          `(stored=${decryptedToken.length}, incoming=${(token ?? '').length}) → returning invalid`,
      );
      return respondInvalid(res);
    }

    if (!timingSafeEqual(Buffer.from(token), Buffer.from(decryptedToken))) {
      Logger.warn(
        `verifySetupToken: token mismatch for user ${id} (lengths matched but bytes differ) → returning invalid`,
      );
      return respondInvalid(res);
    }

    Logger.info(`verifySetupToken: user ${id} → valid`);
    return sendResponse(res, true, CODE.SUCCESS, AUTH_MSG.SETUP_TOKEN_VALID, {
      tokenStatus: 'valid',
    });
  } catch (error) {
    Logger.error(`Error in verifySetupToken: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default verifySetupToken;
