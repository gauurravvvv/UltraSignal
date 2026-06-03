/**
 * deleteOrgBulk — atomically soft-deletes multiple organisations in one transaction.
 *
 * Org configs are fetched in parallel before the transaction to minimise the time
 * spent inside the transaction. Config deletion is best-effort (guarded by null
 * check) — a missing config does not block the org soft-delete.
 *
 * Like single delete, external databases are NOT touched.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  ORGANISATION as ORGANISATION_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { OrganisationConfig } from '../../../shared/db/entities/organisationConfig.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const deleteOrgBulk = async (req: Request, res: Response) => {
  Logger.info(`Bulk delete Organisation request`);

  const { loggedInId, orgs } = res.locals;

  try {
    const deletedIds: string[] = orgs.map((o: any) => o.id);

    const orgConfigs = await Promise.all(
      orgs.map((org: any) =>
        OrganisationConfig.findOne({ where: { id: org.configId } }),
      ),
    );

    await AppDataSource.transaction(async (manager: EntityManager) => {
      for (let i = 0; i < orgs.length; i++) {
        const org = orgs[i];
        const orgConfig = orgConfigs[i];
        org.deletedBy = loggedInId;
        if (orgConfig) orgConfig.deletedBy = loggedInId;
        await manager.save(org);
        if (orgConfig) {
          await manager.save(orgConfig);
          await manager.softRemove(orgConfig);
        }
        await manager.softRemove(org);
      }
    });

    sendResponse(res, true, CODE.SUCCESS, ORGANISATION_MSG.BULK_DELETED, {
      deletedCount: deletedIds.length,
      deletedIds,
    });
  } catch (error) {
    Logger.error(
      `Error while bulk deleting organisations: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default deleteOrgBulk;
