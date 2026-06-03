/**
 * updateOrg — updates organisation profile, security policy, and email config.
 *
 * Organisation name is immutable after creation. Email provider settings are
 * mutually exclusive: switching from SMTP to SES (or vice versa) clears the
 * opposite provider's fields. Setting emailProvider=null clears all email config.
 *
 * All writes (orgConfig + org) are wrapped in a single transaction.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  ORGANISATION as ORGANISATION_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { encryptForOrg } from '../../../shared/services/crypto.service';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const updateOrg = async (req: Request, res: Response) => {
  Logger.info(`Update Organisation request`);

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
    const { loggedInId, org } = res.locals;

    org.status = status;
    org.description = description ? description : org.description;
    org.updatedBy = loggedInId;

    const { orgConfig } = res.locals;
    if (maxLoginAttempts !== undefined)
      orgConfig.maxLoginAttempts = maxLoginAttempts;
    if (accountLockDurationHours !== undefined)
      orgConfig.accountLockDurationHours = accountLockDurationHours;
    if (passwordHistoryLimit !== undefined)
      orgConfig.passwordHistoryLimit = passwordHistoryLimit;
    if (sessionInactivityTimeout !== undefined)
      orgConfig.sessionInactivityTimeout = sessionInactivityTimeout;

    if (emailProvider !== undefined) {
      orgConfig.emailProvider = emailProvider;
      if (emailProvider === 'SMTP') {
        if (smtpHost !== undefined) orgConfig.smtpHost = smtpHost;
        if (smtpPort !== undefined) orgConfig.smtpPort = smtpPort;
        if (smtpUser !== undefined)
          orgConfig.smtpUser = smtpUser
            ? encryptForOrg(smtpUser, orgConfig)
            : null;
        if (smtpPassword)
          orgConfig.smtpPassword = encryptForOrg(smtpPassword, orgConfig);
        if (smtpFrom !== undefined) orgConfig.smtpFrom = smtpFrom;
        orgConfig.sesRegion = null;
        orgConfig.sesAccessKeyId = null;
        orgConfig.sesSecretAccessKey = null;
        orgConfig.sesFrom = null;
      } else if (emailProvider === 'SES') {
        if (sesRegion !== undefined) orgConfig.sesRegion = sesRegion;
        if (sesAccessKeyId !== undefined)
          orgConfig.sesAccessKeyId = sesAccessKeyId
            ? encryptForOrg(sesAccessKeyId, orgConfig)
            : null;
        if (sesSecretAccessKey)
          orgConfig.sesSecretAccessKey = encryptForOrg(
            sesSecretAccessKey,
            orgConfig,
          );
        if (sesFrom !== undefined) orgConfig.sesFrom = sesFrom;
        orgConfig.smtpHost = null;
        orgConfig.smtpPort = null;
        orgConfig.smtpUser = null;
        orgConfig.smtpPassword = null;
        orgConfig.smtpFrom = null;
      } else if (emailProvider === null) {
        orgConfig.smtpHost = null;
        orgConfig.smtpPort = null;
        orgConfig.smtpUser = null;
        orgConfig.smtpPassword = null;
        orgConfig.smtpFrom = null;
        orgConfig.sesRegion = null;
        orgConfig.sesAccessKeyId = null;
        orgConfig.sesSecretAccessKey = null;
        orgConfig.sesFrom = null;
      }
    }

    let result: any;
    await AppDataSource.transaction(async (manager: EntityManager) => {
      await manager.save(orgConfig);
      result = await manager.save(org);
    });

    sendResponse(res, true, CODE.SUCCESS, ORGANISATION_MSG.UPDATED, result);
  } catch (error) {
    Logger.error(
      `Error while updating Organisation: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default updateOrg;
