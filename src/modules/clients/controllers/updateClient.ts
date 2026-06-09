/**
 * updateClient — updates client profile, security policy, and email config.
 *
 * Client name is immutable after creation. Email provider settings are
 * mutually exclusive: switching from SMTP to SES (or vice versa) clears the
 * opposite provider's fields. Setting emailProvider=null clears all email config.
 *
 * All writes (clientConfig + client) are wrapped in a single transaction.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  CLIENT as CLIENT_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { encryptForClient } from '../../../shared/services/crypto.service';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const updateClient = async (req: Request, res: Response) => {
  Logger.info(`Update Client request`);

  try {
    const {
      status,
      description,
      maxLoginAttempts,
      accountLockDurationHours,
      passwordHistoryLimit,
      sessionInactivityTimeout,
      emailProvider,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword,
      smtpFrom,
      sesRegion,
      sesAccessKeyId,
      sesSecretAccessKey,
      sesFrom,
    } = req.body;
    const { loggedInId, client } = res.locals;

    client.status = status;
    client.description = description ? description : client.description;
    client.updatedBy = loggedInId;

    const { clientConfig } = res.locals;
    if (maxLoginAttempts !== undefined)
      clientConfig.maxLoginAttempts = maxLoginAttempts;
    if (accountLockDurationHours !== undefined)
      clientConfig.accountLockDurationHours = accountLockDurationHours;
    if (passwordHistoryLimit !== undefined)
      clientConfig.passwordHistoryLimit = passwordHistoryLimit;
    if (sessionInactivityTimeout !== undefined)
      clientConfig.sessionInactivityTimeout = sessionInactivityTimeout;

    if (emailProvider !== undefined) {
      clientConfig.emailProvider = emailProvider;
      if (emailProvider === 'SMTP') {
        if (smtpHost !== undefined) clientConfig.smtpHost = smtpHost;
        if (smtpPort !== undefined) clientConfig.smtpPort = smtpPort;
        if (smtpUser !== undefined)
          clientConfig.smtpUser = smtpUser
            ? encryptForClient(smtpUser)
            : null;
        if (smtpPassword)
          clientConfig.smtpPassword = encryptForClient(smtpPassword);
        if (smtpFrom !== undefined) clientConfig.smtpFrom = smtpFrom;
        clientConfig.sesRegion = null;
        clientConfig.sesAccessKeyId = null;
        clientConfig.sesSecretAccessKey = null;
        clientConfig.sesFrom = null;
      } else if (emailProvider === 'SES') {
        if (sesRegion !== undefined) clientConfig.sesRegion = sesRegion;
        if (sesAccessKeyId !== undefined)
          clientConfig.sesAccessKeyId = sesAccessKeyId
            ? encryptForClient(sesAccessKeyId)
            : null;
        if (sesSecretAccessKey)
          clientConfig.sesSecretAccessKey = encryptForClient(sesSecretAccessKey);
        if (sesFrom !== undefined) clientConfig.sesFrom = sesFrom;
        clientConfig.smtpHost = null;
        clientConfig.smtpPort = null;
        clientConfig.smtpUser = null;
        clientConfig.smtpPassword = null;
        clientConfig.smtpFrom = null;
      } else if (emailProvider === null) {
        clientConfig.smtpHost = null;
        clientConfig.smtpPort = null;
        clientConfig.smtpUser = null;
        clientConfig.smtpPassword = null;
        clientConfig.smtpFrom = null;
        clientConfig.sesRegion = null;
        clientConfig.sesAccessKeyId = null;
        clientConfig.sesSecretAccessKey = null;
        clientConfig.sesFrom = null;
      }
    }

    let result: any;
    await AppDataSource.transaction(async (manager: EntityManager) => {
      await manager.save(clientConfig);
      result = await manager.save(client);
    });

    sendResponse(res, true, CODE.SUCCESS, CLIENT_MSG.UPDATED, result);
  } catch (error) {
    Logger.error(
      `Error while updating Client: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default updateClient;
