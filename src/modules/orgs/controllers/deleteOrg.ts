/**
 * deleteOrg — soft-deletes an organisation and its config in one atomic transaction.
 *
 * Both the Organisation and OrganisationConfig rows are soft-deleted together.
 * The org's external database is NOT touched — data is preserved for potential
 * recovery and the system admin must clean up the external DB manually if needed.
 *
 * deletedBy is stamped on both records before the soft-delete so the audit trail
 * records who triggered the deletion.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import {
  GENERIC,
  ORGANISATION as ORGANISATION_MSG,
} from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { Organisation } from '../../../shared/db/entities/organisation.entity';
import { OrganisationConfig } from '../../../shared/db/entities/organisationConfig.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

const deleteOrg = async (req: Request, res: Response) => {
  try {
    Logger.info(`Delete Organisation request`);

    const { loggedInId, org } = res.locals;

    const orgConfig = await OrganisationConfig.findOne({
      where: { id: org.configId },
    });

    if (!orgConfig) {
      return sendResponse(
        res,
        false,
        CODE.NOT_FOUND,
        ORGANISATION_MSG.NOT_FOUND,
      );
    }

    await AppDataSource.transaction(async manager => {
      org.deletedBy = loggedInId;
      orgConfig.deletedBy = loggedInId;
      await manager.save(Organisation, org);
      await manager.save(OrganisationConfig, orgConfig);
      await manager.softRemove(Organisation, org);
      await manager.softRemove(OrganisationConfig, orgConfig);
    });

    sendResponse(res, true, CODE.SUCCESS, ORGANISATION_MSG.DELETED);
  } catch (error) {
    Logger.error(
      `Error while deleting organisation: ${getErrorMessage(error)}`,
    );
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default deleteOrg;
