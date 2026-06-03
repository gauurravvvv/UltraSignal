/**
 * bulkAddUserCommit — creates a batch of users from the pre-validated payload
 * produced by /bulk-add/validate.
 *
 * Each row is processed in its own transaction (per-row partial success): a
 * failure on one user does NOT roll back the whole batch. The successful
 * rows return in `successful[]`, the failures in `failed[]`. This matches the
 * UX promise that admins can fix bad rows and re-upload.
 *
 * The validate step already screened these rows, so the only failures expected
 * here come from the race window between validate and commit:
 *   - Another admin creates a user with the same email/username in the same
 *     org during that gap.
 *   - A group is deleted in the same gap.
 * Both are re-checked up-front in a single batch query each (cheap) so the
 * common case avoids per-row DB conflicts.
 *
 * Welcome emails are fire-and-forget after the response is sent, batched in
 * groups of 10 with a 200ms gap to avoid SMTP/SES burst limits.
 */
import { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import {
  CODE,
  SETUP_TOKEN_EXPIRY_HOURS,
  STATUS,
} from '../../../../config/config';
import {
  GENERIC,
  USER as USER_MSG,
} from '../../../shared/constants/response.messages';
import { Group } from '../../../shared/db/entities/group.entity';
import { UserGroupMapping } from '../../../shared/db/entities/user-group-mapping.entity';
import { User } from '../../../shared/db/entities/user.entity';
import {
  decryptForOrg,
  encryptForOrg,
} from '../../../shared/services/crypto.service';
import { generateSetupToken } from '../../../shared/utility/generateSetupToken';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import { OrgEmailConfig } from '../../../shared/utility/mail';
import welcomeEmailToUser from '../../../shared/utility/mail/welcomeEmailToUser';
import sendResponse from '../../../shared/utility/response';
import { AppDataSource } from '../../../shared/db';

interface IncomingUser {
  row: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  groupIds: string[];
  groupNames?: string[];
  locale: string;
}

interface SuccessfulRow {
  row: number;
  email: string;
  username: string;
  userId: string;
}

interface FailedRow {
  row: number;
  email: string;
  reason: string;
}

const EMAIL_BURST_SIZE = 10;
const EMAIL_BURST_GAP_MS = 200;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const bulkAddUserCommit = async (req: Request, res: Response) => {
  Logger.info('Bulk add user — commit request');

  const { users } = req.body as { users: IncomingUser[] };
  const { loggedInId, orgData } = res.locals;

  const failed: FailedRow[] = [];
  const successful: SuccessfulRow[] = [];

  try {
    // 1. Re-validate uniqueness (race-safety net) — one batch query each.
    const emails = users.map(u => u.email);
    const usernames = users.map(u => u.username);

    const existingByEmail: any[] = await AppDataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .select(['user.email'])
      .where('user.organisationId = :orgId', { orgId: orgData.id })
      .andWhere('user.email IN (:...emails)', { emails })
      .getMany();
    const collidingEmails = new Set(existingByEmail.map(u => u.email));

    const existingByUsername: any[] = await AppDataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .select(['user.username'])
      .where('user.organisationId = :orgId', { orgId: orgData.id })
      .andWhere('user.username IN (:...usernames)', { usernames })
      .getMany();
    const collidingUsernames = new Set(existingByUsername.map(u => u.username));

    // 2. Re-validate group existence + active status.
    const allGroupIds = Array.from(new Set(users.flatMap(u => u.groupIds)));
    const liveGroups: any[] =
      allGroupIds.length > 0
        ? await AppDataSource
            .getRepository(Group)
            .createQueryBuilder('g')
            .select(['g.id'])
            .where('g.organisationId = :orgId', { orgId: orgData.id })
            .andWhere('g.status = :status', { status: '1' })
            .andWhere('g.id IN (:...ids)', { ids: allGroupIds })
            .getMany()
        : [];
    const liveGroupIds = new Set(liveGroups.map(g => g.id));

    // Split users into ready-to-create vs. now-failing.
    const ready: IncomingUser[] = [];
    for (const u of users) {
      if (collidingEmails.has(u.email)) {
        failed.push({
          row: u.row,
          email: u.email,
          reason: 'Email already exists in this organisation',
        });
        continue;
      }
      if (collidingUsernames.has(u.username)) {
        failed.push({
          row: u.row,
          email: u.email,
          reason: 'Username already exists in this organisation',
        });
        continue;
      }
      const missingGroup = u.groupIds.find(id => !liveGroupIds.has(id));
      if (missingGroup) {
        failed.push({
          row: u.row,
          email: u.email,
          reason: 'One or more groups no longer exist or are inactive',
        });
        continue;
      }
      ready.push(u);
    }

    // 3. Build email config once — the org's SMTP/SES creds are shared across
    //    all rows.
    const orgEmailConfig: OrgEmailConfig | undefined = orgData.config
      ?.emailProvider
      ? {
          emailProvider: orgData.config.emailProvider,
          smtpHost: orgData.config.smtpHost,
          smtpPort: orgData.config.smtpPort,
          smtpUser: orgData.config.smtpUser
            ? decryptForOrg(orgData.config.smtpUser, orgData.config)
            : null,
          smtpPassword: orgData.config.smtpPassword
            ? decryptForOrg(orgData.config.smtpPassword, orgData.config)
            : null,
          smtpFrom: orgData.config.smtpFrom,
          sesRegion: orgData.config.sesRegion,
          sesAccessKeyId: orgData.config.sesAccessKeyId
            ? decryptForOrg(orgData.config.sesAccessKeyId, orgData.config)
            : null,
          sesSecretAccessKey: orgData.config.sesSecretAccessKey
            ? decryptForOrg(orgData.config.sesSecretAccessKey, orgData.config)
            : null,
          sesFrom: orgData.config.sesFrom,
        }
      : undefined;

    // 4. Per-row transactional insert. Collect the plain-text setup tokens
    //    for emails to send AFTER the response — we never store these.
    const pendingEmails: {
      email: string;
      fullName: string;
      username: string;
      userId: string;
      setupToken: string;
      locale: string;
    }[] = [];

    for (const u of ready) {
      try {
        const setupToken = generateSetupToken();
        const encryptedToken = encryptForOrg(setupToken, orgData.config);
        const expiresAt = new Date(
          Date.now() + SETUP_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
        );

        let savedUser: User | null = null;

        await AppDataSource.manager.transaction(
          async (manager: EntityManager) => {
            const user = new User();
            user.firstName = u.firstName;
            user.lastName = u.lastName;
            user.email = u.email;
            user.username = u.username;
            user.status = STATUS.ACTIVE;
            user.organisationName = orgData.name;
            user.organisationId = orgData.id;
            user.createdBy = loggedInId;
            user.locale = u.locale;
            user.setupToken = encryptedToken;
            user.setupTokenExpiresAt = expiresAt;

            const persisted = await manager.getRepository(User).save(user);
            savedUser = persisted;

            const mappings = u.groupIds.map(gId => {
              const m = new UserGroupMapping();
              m.userId = persisted.id;
              m.groupId = gId;
              return m;
            });
            await manager.getRepository(UserGroupMapping).save(mappings);
          },
        );

        if (savedUser) {
          successful.push({
            row: u.row,
            email: u.email,
            username: u.username,
            userId: (savedUser as User).id,
          });

          pendingEmails.push({
            email: u.email,
            fullName: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
            username: u.username,
            userId: (savedUser as User).id,
            setupToken,
            locale: u.locale,
          });
        }
      } catch (err) {
        Logger.error(
          `Bulk add row ${u.row} (${u.email}) failed: ${getErrorMessage(err)}`,
        );
        failed.push({
          row: u.row,
          email: u.email,
          reason: 'Database error while creating user',
        });
      }
    }

    // 5. Sort response arrays by CSV row order.
    successful.sort((a, b) => a.row - b.row);
    failed.sort((a, b) => a.row - b.row);

    sendResponse(res, true, CODE.SUCCESS, USER_MSG.CREATED, {
      summary: {
        requested: users.length,
        successful: successful.length,
        failed: failed.length,
      },
      successful,
      failed,
    });

    // 6. Fire-and-forget email burst, batched with a small gap so we don't
    //    hammer SMTP/SES. Doesn't block the response or affect DB state.
    (async () => {
      for (let i = 0; i < pendingEmails.length; i += EMAIL_BURST_SIZE) {
        const batch = pendingEmails.slice(i, i + EMAIL_BURST_SIZE);
        await Promise.all(
          batch.map(p =>
            welcomeEmailToUser(
              p.email,
              p.fullName,
              p.username,
              orgData.name,
              p.userId,
              orgData.id,
              p.setupToken,
              orgEmailConfig,
              p.locale,
            ),
          ),
        );
        if (i + EMAIL_BURST_SIZE < pendingEmails.length) {
          await sleep(EMAIL_BURST_GAP_MS);
        }
      }
    })().catch(err => {
      Logger.error(`Bulk add email burst failed: ${getErrorMessage(err)}`);
    });
  } catch (error) {
    Logger.error(`Bulk add commit error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default bulkAddUserCommit;
