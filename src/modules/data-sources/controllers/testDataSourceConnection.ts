/**
 * testDataSourceConnection — opens a one-shot Postgres connection with
 * the supplied credentials and returns whether it works. Nothing is
 * persisted — this is a probe for the "Test Connection" button on the
 * data-source form.
 *
 * Sequence:
 *   1. `pg.Client.connect()` with a 5s timeout — fails fast on bad host,
 *      bad port, network unreachable, wrong password.
 *   2. `SELECT 1` — confirms the session is healthy.
 *   3. `SELECT 1 FROM pg_namespace WHERE nspname = $1` — confirms the
 *      requested schema actually exists in the target DB.
 *   4. `client.end()` ALWAYS runs in a finally block so we don't leak
 *      sockets on probe failures.
 *
 * Error handling exposes the underlying `error.message` so the user can
 * see WHY the test failed ("password authentication failed",
 * "connection refused", "database does not exist"). Stack traces and
 * internal fields are stripped. Passwords are never logged.
 *
 * The endpoint is gated upstream by `dataSource` WRITE — testing is a
 * write-class action because it fires authenticated requests at external
 * hosts on the user's behalf.
 */
import { Request, Response } from 'express';
import { Client as PgClient } from 'pg';
import { CODE } from '../../../../config/config';
import {
  DATA_SOURCE as DS_MSG,
  GENERIC,
} from '../../../shared/constants/response.messages';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

interface TestConnectionBody {
  host: string;
  port: number;
  dbname: string;
  username: string;
  password: string;
  schema: string;
}

const CONNECT_TIMEOUT_MS = 5000;
const STATEMENT_TIMEOUT_MS = 5000;

const testDataSourceConnection = async (req: Request, res: Response) => {
  Logger.info('Test Data Source connection request');

  const { host, port, dbname, username, password, schema } =
    req.body as TestConnectionBody;

  const client = new PgClient({
    host,
    port,
    database: dbname,
    user: username,
    password,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
  });

  try {
    await client.connect();
    await client.query('SELECT 1');

    const schemaCheck = await client.query<{ exists: number }>(
      'SELECT 1 AS exists FROM pg_namespace WHERE nspname = $1 LIMIT 1',
      [schema],
    );

    if (schemaCheck.rowCount === 0) {
      Logger.info(`Test connection: schema "${schema}" not found on ${host}`);
      return sendResponse(
        res,
        false,
        CODE.NOT_FOUND,
        DS_MSG.SCHEMA_NOT_FOUND,
      );
    }

    Logger.info(`Test connection succeeded for ${username}@${host}:${port}/${dbname}`);
    return sendResponse(res, true, CODE.SUCCESS, DS_MSG.CONNECTION_OK, {
      ok: true,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    // Surface the Postgres error to the user so they can act on it,
    // but log only the message — never the body (password is in it).
    Logger.warn(`Test connection failed for ${username}@${host}:${port}/${dbname}: ${message}`);
    return sendResponse(res, false, CODE.BAD_REQUEST, message);
  } finally {
    // Always close — even if connect() threw we may have a half-open
    // socket. `end()` on a never-connected client is a no-op, and we
    // swallow any error here because the response is already on its way.
    try {
      await client.end();
    } catch (closeErr) {
      Logger.debug(
        `Test connection cleanup error (ignored): ${getErrorMessage(closeErr)}`,
      );
    }

    if (!res.headersSent) {
      // Defensive — every branch above sends a response, but if a future
      // change adds an early return without one, this prevents a hung
      // request.
      sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
    }
  }
};

export default testDataSourceConnection;
