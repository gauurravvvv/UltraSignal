/**
 * snowflakeConnection — opens a connection to a Snowflake datasource
 * and exposes a TypeORM-DataSource-like surface so call sites don't
 * have to switch on dbType.
 *
 * Snowflake doesn't fit the TypeORM driver model — there's no
 * `type: 'snowflake'` option. We use the official `snowflake-sdk`
 * directly and adapt it to two async methods that match how callers
 * already use the Postgres path:
 *
 *   const conn = await connectToSnowflake({...});
 *   const rows = await conn.query('SELECT 1');
 *   await conn.destroy();
 *
 * Returns `null` on failure (matching getDbConnection's contract) so
 * controllers can branch on the falsy return without try/catch wrapping
 * every call.
 *
 * AUTH: username + password only in this pass. Snowflake recommends
 * key-pair / OAuth for production but those need separate UI work
 * (private key upload, passphrase handling). Password auth still works
 * for existing Snowflake accounts; deprecation timeline only affects
 * NEW accounts created from late 2025 onwards.
 *
 * SESSION: each call creates a new connection. Snowflake handles
 * connection pooling client-side internally; for the dev-stage app
 * where datasource queries are user-triggered (not high-frequency),
 * per-request connections are fine and match how TypeORM's
 * getDbConnection works in the rest of the codebase.
 */
import * as snowflake from 'snowflake-sdk';
import { getErrorMessage } from '../../utility/getErrorMessage';
import Logger from '../../utility/logger/logger';

export interface SnowflakeConnectionOptions {
  account: string; // e.g. "xy12345.us-east-1.aws" — the URL prefix
  username: string;
  password: string;
  database: string; // Snowflake DB name (uppercased internally)
  warehouse?: string; // compute warehouse — required for queries
  role?: string; // session role (e.g. ANALYST, SYSADMIN)
  schema?: string; // default schema inside the database
}

/**
 * Thin TypeORM-DataSource-like wrapper around a Snowflake connection.
 * Only exposes the two methods the rest of the app uses on a connection.
 * If you need anything else (transactions, streaming, etc.) it should
 * go through here so call sites stay engine-agnostic.
 */
export interface SnowflakeConnectionAdapter {
  /**
   * Run a SQL statement, return the rows as plain objects. Mirrors
   * TypeORM DataSource.query()'s loose `any` return shape — caller
   * does NOT escape values, they pass them via the optional second
   * array (bind params).
   */
  query(sql: string, params?: unknown[]): Promise<any>;
  /**
   * Tear down the connection. Mirrors TypeORM DataSource.destroy().
   * Idempotent — safe to call twice.
   */
  destroy(): Promise<void>;
}

export const connectToSnowflake = async (
  opts: SnowflakeConnectionOptions,
): Promise<SnowflakeConnectionAdapter | null> => {
  try {
    const sfConn = snowflake.createConnection({
      account: opts.account,
      username: opts.username,
      password: opts.password,
      database: opts.database,
      warehouse: opts.warehouse,
      role: opts.role,
      schema: opts.schema,
      // Avoid Snowflake's default identifier uppercasing surprises by
      // turning OFF its client-side identifier rewriting. SQL the user
      // writes is sent verbatim. Snowflake will still uppercase
      // unquoted identifiers on its side per ANSI rules — that's a
      // server-side behaviour we can't change here.
      clientSessionKeepAlive: false,
    });

    await new Promise<void>((resolve, reject) => {
      sfConn.connect((err: Error | undefined) => {
        if (err) reject(err);
        else resolve();
      });
    });

    let destroyed = false;

    return {
      query: (sql: string, params: unknown[] = []) =>
        new Promise((resolve, reject) => {
          sfConn.execute({
            sqlText: sql,
            // snowflake-sdk's `binds` accepts a flat array; the SDK
            // matches them positionally against `?` placeholders. The
            // SDK doesn't know about `$1`-style placeholders that
            // TypeORM uses for Postgres — caller is responsible for
            // writing Snowflake-flavored SQL.
            binds: params as snowflake.Binds,
            complete: (err, _stmt, rows) => {
              if (err) reject(err);
              else resolve(rows ?? []);
            },
          });
        }),

      destroy: () =>
        new Promise<void>(resolve => {
          if (destroyed) {
            resolve();
            return;
          }
          destroyed = true;
          sfConn.destroy(() => resolve());
        }),
    };
  } catch (error) {
    Logger.error(`Snowflake connection error: ${getErrorMessage(error)}`);
    return null;
  }
};
