/**
 * systemAdminHome — returns summary counts for a client's dashboard.
 *
 * `totalAdmins` and `totalUsers` currently both query `User` without a role filter,
 * so they return the same total count. This is a known limitation — splitting by role
 * requires a role field query against the shared entity, which this controller does
 * not currently do.
 *
 * The inner `Promise.all(...).catch` swallows count errors silently (counts default to
 * undefined in response) so a failure in one counter does not 500 the whole endpoint.
 * The client lookup check before the Promise.all still gates on client existence.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  HOME as HOME_MSG,
  CLIENT as CLIENT_MSG,
} from '../../../shared/constants/response.messages';
import { Client } from '../../../shared/db/entities/client.entity';
import { User } from '../../../shared/db/entities/user.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const systemAdminHome = async (req: Request, res: Response) => {
  Logger.info(`System Admin Home Request`);

  const id = res.locals.clientId;
  let response: any = {};

  try {
    const client: Client | null = await Client.findOne({
      where: { id },
      relations: ['config'],
    });

    if (!client) {
      sendResponse(res, false, CODE.NOT_FOUND, CLIENT_MSG.NOT_FOUND);
      return;
    }
    let totalAdmins = User.count({
      where: { clientId: id },
    });
    let totalUsers = User.count({
      where: { clientId: id },
    });

    await Promise.all([totalAdmins, totalUsers])
      .then(([adminsCount, usersCount]) => {
        response.adminsCount = adminsCount;
        response.usersCount = usersCount;
      })
      .catch(error => {
        Logger.error(`Error fetching home data: ${getErrorMessage(error)}`);
      });

    sendResponse(res, true, CODE.SUCCESS, HOME_MSG.FETCHED, response);
  } catch (error) {
    Logger.error(`Error in systemAdminHome: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default systemAdminHome;
