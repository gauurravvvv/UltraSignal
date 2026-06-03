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
 *     client during that gap.
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
  decryptForClient,
  encryptForClient,
} from '../../../shared/services/crypto.service';
import { generateSetupToken } from '../../../shared/utility/generateSetupToken';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import { ClientEmailConfig } from '../../../shared/utility/mail';
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
  const { loggedInId, clientData } = res.locals;

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
      .where('user.clientId = :clientId', { clientId: clientData.id })
      .andWhere('user.email IN (:...emails)', { emails })
      .getMany();
    const collidingEmails = new Set(existingByEmail.map(u => u.email));

    const existingByUsername: any[] = await AppDataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .select(['user.username'])
      .where('user.clientId = :clientId', { clientId: clientData.id })
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
            .where('g.clientId = :clientId', { clientId: clientData.id })
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
          reason: 'Email already exists in this client',
        });
        continue;
      }
      if (collidingUsernames.has(u.username)) {
        failed.push({
          row: u.row,
          email: u.email,
          reason: 'Username already exists in this client',
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

    // 3. Build email config once — the client's SMTP/SES creds are shared across
    //    all rows.
    const clientEmailConfig: ClientEmailConfig | undefined = clientData.config
      ?.emailProvider
      ? {
          emailProvider: clientData.config.emailProvider,
          smtpHost: clientData.config.smtpHost,
          smtpPort: clientData.config.smtpPort,
          smtpUser: clientData.config.smtpUser
            ? decryptForClient(clientData.config.smtpUser, clientData.config)
            : null,
          smtpPassword: clientData.config.smtpPassword
            ? decryptForClient(clientData.config.smtpPassword, clientData.config)
            : null,
          smtpFrom: clientData.config.smtpFrom,
          sesRegion: clientData.config.sesRegion,
          sesAccessKeyId: clientData.config.sesAccessKeyId
            ? decryptForClient(clientData.config.sesAccessKeyId, clientData.config)
            : null,
          sesSecretAccessKey: clientData.config.sesSecretAccessKey
            ? decryptForClient(clientData.config.sesSecretAccessKey, clientData.config)
            : null,
          sesFrom: clientData.config.sesFrom,
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
        const encryptedToken = encryptForClient(setupToken, clientData.config);
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
            user.clientName = clientData.name;
            user.clientId = clientData.id;
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
              clientData.name,
              p.userId,
              clientData.id,
              p.setupToken,
              clientEmailConfig,
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
