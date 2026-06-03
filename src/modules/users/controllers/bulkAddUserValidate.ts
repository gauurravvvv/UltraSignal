/**
 * bulkAddUserValidate — dry-run validator for the bulk-user CSV upload.
 *
 * No DB writes. Parses the CSV, runs every per-row check the single-user add
 * endpoint runs, and returns a split of valid[] vs invalid[] with explicit
 * reasons per failure. The FE shows the invalid rows to the admin in a
 * confirmation popup before calling /bulk-add/commit.
 *
 * Checks (in order; first failure wins per row):
 *   1. File-level: row count ≤ 500, header columns match expected set
 *   2. Required fields present
 *   3. Joi schema per field (email, username, names, locale)
 *   4. groupNames non-empty
 *   5. Intra-file duplicate email or username
 *   6. DB: email already exists in this org
 *   7. DB: username already exists in this org
 *   8. DB: every groupName resolves to an active group
 *
 * Valid rows come back with groupNames resolved to groupIds so the commit
 * endpoint doesn't have to re-resolve.
 */
import { parse } from 'csv-parse/sync';
import { Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../../config/config';
import { Group } from '../../../shared/db/entities/group.entity';
import { User } from '../../../shared/db/entities/user.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { SUPPORTED_LOCALES } from '../../../shared/utility/i18n';
import { fields } from '../../../shared/utility/joi.schemas';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { AppDataSource } from '../../../shared/db';

const MAX_ROWS = 500;
const EXPECTED_HEADERS = [
  'email',
  'username',
  'firstName',
  'lastName',
  'groupNames',
  'locale',
] as const;

/**
 * Per-row schema. Mirrors single-user addUser.validation but with groupNames
 * as a pipe-separated string (resolved to groupIds after the schema pass).
 */
const rowSchema = Joi.object({
  email: fields.email.required(),
  username: fields.username.required(),
  firstName: fields.firstName.required(),
  lastName: fields.lastName.required(),
  groupNames: Joi.string().trim().required().messages({
    'string.empty': 'At least one group must be specified',
    'any.required': 'At least one group must be specified',
  }),
  locale: Joi.string()
    .valid(...SUPPORTED_LOCALES)
    .empty('')
    .default('en')
    .messages({
      'any.only': `Locale must be one of: ${SUPPORTED_LOCALES.join(', ')}`,
    }),
}).unknown(false);

interface InvalidRow {
  row: number;
  email?: string;
  reason: string;
}

interface ValidRow {
  row: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  groupIds: string[];
  groupNames: string[];
  locale: string;
}

const bulkAddUserValidate = async (req: Request, res: Response) => {
  Logger.info('Bulk add user — validate request');

  const { orgData } = res.locals;
  const file = req.file as Express.Multer.File | undefined;

  if (!file) {
    return sendResponse(res, false, CODE.BAD_REQUEST, 'CSV file is required');
  }

  // 1. Parse the CSV. csv-parse is strict by default — bad quoting, ragged
  //    row counts, encoding issues all throw here.
  let rows: Record<string, string>[];
  try {
    rows = parse(file.buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch (err) {
    return sendResponse(
      res,
      false,
      CODE.BAD_REQUEST,
      `CSV is malformed: ${getErrorMessage(err)}`,
    );
  }

  // 2. File-level checks: row count, header shape.
  if (rows.length === 0) {
    return sendResponse(res, false, CODE.BAD_REQUEST, 'CSV has no data rows');
  }
  if (rows.length > MAX_ROWS) {
    return sendResponse(
      res,
      false,
      CODE.BAD_REQUEST,
      `Too many rows. Max ${MAX_ROWS} per upload`,
    );
  }
  const headerKeys = Object.keys(rows[0]);
  const missingHeaders = EXPECTED_HEADERS.filter(
    h => h !== 'locale' && !headerKeys.includes(h),
  );
  if (missingHeaders.length > 0) {
    return sendResponse(
      res,
      false,
      CODE.BAD_REQUEST,
      `Missing required columns: ${missingHeaders.join(', ')}`,
    );
  }

  const invalid: InvalidRow[] = [];
  // Schema-passed records, keyed by row index for dup detection in next step.
  type SchemaPassed = {
    row: number;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    groupNames: string[];
    locale: string;
  };
  const schemaPassed: SchemaPassed[] = [];

  // 3. Per-row Joi schema. Row numbers are 1-indexed and account for the
  //    header row, so the data on CSV row 2 is the first record (row=2 in
  //    the response).
  rows.forEach((raw, idx) => {
    const rowNum = idx + 2;
    const { error, value } = rowSchema.validate(raw, { abortEarly: true });
    if (error) {
      invalid.push({
        row: rowNum,
        email: raw.email,
        reason: error.message,
      });
      return;
    }
    const groupNames = value.groupNames
      .split('|')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
    if (groupNames.length === 0) {
      invalid.push({
        row: rowNum,
        email: value.email,
        reason: 'At least one group must be specified',
      });
      return;
    }
    schemaPassed.push({
      row: rowNum,
      email: value.email,
      username: value.username,
      firstName: value.firstName,
      lastName: value.lastName,
      groupNames,
      locale: value.locale,
    });
  });

  // 4. Intra-file duplicates. First occurrence wins; later ones are flagged.
  //    Useful when an admin copy-pastes rows and forgets to update one field.
  const firstSeenEmailRow = new Map<string, number>();
  const firstSeenUsernameRow = new Map<string, number>();
  const dupFlagged = new Set<number>();
  for (const r of schemaPassed) {
    if (firstSeenEmailRow.has(r.email)) {
      invalid.push({
        row: r.row,
        email: r.email,
        reason: `Duplicate email in upload (also on row ${firstSeenEmailRow.get(r.email)})`,
      });
      dupFlagged.add(r.row);
      continue;
    }
    if (firstSeenUsernameRow.has(r.username)) {
      invalid.push({
        row: r.row,
        email: r.email,
        reason: `Duplicate username in upload (also on row ${firstSeenUsernameRow.get(r.username)})`,
      });
      dupFlagged.add(r.row);
      continue;
    }
    firstSeenEmailRow.set(r.email, r.row);
    firstSeenUsernameRow.set(r.username, r.row);
  }
  const intraDedup = schemaPassed.filter(r => !dupFlagged.has(r.row));

  if (intraDedup.length === 0) {
    return sendResponse(
      res,
      true,
      CODE.SUCCESS,
      'Bulk user validation complete',
      {
        summary: { total: rows.length, valid: 0, invalid: invalid.length },
        valid: [],
        invalid,
      },
    );
  }

  // 5. DB uniqueness — one query each for email and username collisions.
  //    Org-scoped because email/username uniqueness is per-organisation here.
  const allEmails = intraDedup.map(r => r.email);
  const allUsernames = intraDedup.map(r => r.username);

  const existingByEmail = await AppDataSource
    .getRepository(User)
    .createQueryBuilder('user')
    .select(['user.email'])
    .where('user.organisationId = :orgId', { orgId: orgData.id })
    .andWhere('user.email IN (:...emails)', { emails: allEmails })
    .getMany();
  const collidingEmails = new Set(existingByEmail.map((u: any) => u.email));

  const existingByUsername = await AppDataSource
    .getRepository(User)
    .createQueryBuilder('user')
    .select(['user.username'])
    .where('user.organisationId = :orgId', { orgId: orgData.id })
    .andWhere('user.username IN (:...usernames)', { usernames: allUsernames })
    .getMany();
  const collidingUsernames = new Set(
    existingByUsername.map((u: any) => u.username),
  );

  const dbConflictFlagged = new Set<number>();
  for (const r of intraDedup) {
    if (collidingEmails.has(r.email)) {
      invalid.push({
        row: r.row,
        email: r.email,
        reason: 'Email already exists in this organisation',
      });
      dbConflictFlagged.add(r.row);
      continue;
    }
    if (collidingUsernames.has(r.username)) {
      invalid.push({
        row: r.row,
        email: r.email,
        reason: 'Username already exists in this organisation',
      });
      dbConflictFlagged.add(r.row);
    }
  }
  const dbCleared = intraDedup.filter(r => !dbConflictFlagged.has(r.row));

  // 6. Group resolution. Pull every distinct group name across remaining rows,
  //    look them up in one query, and build a name → id map.
  const allGroupNames = Array.from(
    new Set(dbCleared.flatMap(r => r.groupNames)),
  );
  const groups: { id: string; name: string }[] =
    allGroupNames.length > 0
      ? await AppDataSource
          .getRepository(Group)
          .createQueryBuilder('g')
          .select(['g.id', 'g.name'])
          .where('g.organisationId = :orgId', { orgId: orgData.id })
          .andWhere('g.status = :status', { status: '1' })
          .andWhere('g.name IN (:...names)', { names: allGroupNames })
          .getMany()
      : [];
  const groupNameToId = new Map(groups.map((g: any) => [g.name, g.id]));

  const valid: ValidRow[] = [];
  for (const r of dbCleared) {
    const missing = r.groupNames.filter(n => !groupNameToId.has(n));
    if (missing.length > 0) {
      invalid.push({
        row: r.row,
        email: r.email,
        reason: `Group '${missing[0]}' does not exist or is inactive`,
      });
      continue;
    }
    valid.push({
      row: r.row,
      email: r.email,
      username: r.username,
      firstName: r.firstName,
      lastName: r.lastName,
      groupIds: r.groupNames.map(n => groupNameToId.get(n) as string),
      groupNames: r.groupNames,
      locale: r.locale,
    });
  }

  // Sort by row number so the response mirrors the CSV order.
  invalid.sort((a, b) => a.row - b.row);
  valid.sort((a, b) => a.row - b.row);

  return sendResponse(
    res,
    true,
    CODE.SUCCESS,
    'Bulk user validation complete',
    {
      summary: {
        total: rows.length,
        valid: valid.length,
        invalid: invalid.length,
      },
      valid,
      invalid,
    },
  );
};

export default bulkAddUserValidate;
