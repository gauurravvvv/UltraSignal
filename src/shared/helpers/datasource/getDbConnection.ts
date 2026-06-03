/**
 * getDbConnection — opens a per-request TypeORM DataSource.
 *
 * Used in two distinct contexts and the caller has to tell us which:
 *
 *   1. **Master DB / per-client master DB.** The platform's own metadata
 *      (datasources, datasets, analyses, audit logs, …) lives in a
 *      dedicated Postgres schema named ULTRASIGNAL_SCHEMA_NAME. We pin the
 *      schema at connection time so TypeORM's repository queries
 *      target it without `SET search_path` boilerplate. Always
 *      Postgres. Callers pass `isMasterDb = true`.
 *
 *   2. **User-created external datasource.** A customer's database
 *      that we read from. May be Postgres, MySQL, MariaDB, MSSQL, or
 *      Oracle (Snowflake has its own helper — snowflakeConnection.ts).
 *      We must NOT pin ULTRASIGNAL_SCHEMA_NAME here — the customer's
 *      tables live wherever they put them (usually `public` for
 *      Postgres). Pinning would cause every query to fail with
 *      "relation does not exist" because TypeORM would prepend our
 *      schema name to every table reference. Callers leave
 *      `isMasterDb` at the default (false).
 *
 * Returns `null` on failure rather than throwing so callers can check
 * and return a 404/500 without try-catch boilerplate. Caller is
 * responsible for `dataSource.destroy()` — each call creates a new
 * DataSource (not pooled) so connections would leak otherwise.
 *
 * `sync: false` by default. Callers that need schema sync (client
 * onboarding) pass `true` — and that case is always master-DB, so
 * isMasterDb is also true there.
 */
import { DataSource, DataSourceOptions } from 'typeorm';
import {
  CONNECTION_TIMEOUT,
  DB_TYPES,
  ULTRASIGNAL_SCHEMA_NAME,
} from '../../../../config/config';
import { getErrorMessage } from '../../utility/getErrorMessage';
import Logger from '../../utility/logger/logger';

/**
 * TypeORM-engine subset of DB_TYPES. Snowflake is intentionally
 * excluded — it has no TypeORM driver and goes through
 * snowflakeConnection.ts instead. The keys listed here are the only
 * values getDbConnection() can accept as `dbType`.
 *
 * Master / per-client master DBs are always Postgres.
 */
export type SupportedDbType =
  | typeof DB_TYPES.POSTGRES
  | typeof DB_TYPES.MYSQL
  | typeof DB_TYPES.MARIADB
  | typeof DB_TYPES.MSSQL
  | typeof DB_TYPES.ORACLE;

export const getDbConnection = async (
  hostname: string,
  port: number,
  username: string,
  password: string,
  dbName: string,
  entities?: any[],
  sync: boolean = false,
  dbType: SupportedDbType = DB_TYPES.POSTGRES,
  isMasterDb: boolean = false,
): Promise<DataSource | null> => {
  try {
    const baseOptions = {
      connectTimeoutMS: CONNECTION_TIMEOUT,
      type: dbType,
      host: hostname,
      port: port,
      username: username,
      password,
      database: dbName,
      synchronize: sync,
      logging: true,
      entities: entities,
    };

    // Pin ULTRASIGNAL_SCHEMA_NAME only for master-DB connections (always
    // Postgres). For user-created external datasources — even Postgres
    // ones — leave the schema unset so TypeORM uses the database's
    // own default (`public` for Postgres). Pinning the master schema on
    // an external datasource would force every query into a non-existent
    // schema.
    const options =
      isMasterDb && dbType === DB_TYPES.POSTGRES
        ? { ...baseOptions, schema: ULTRASIGNAL_SCHEMA_NAME }
        : baseOptions;

    const dataSource = new DataSource(options as DataSourceOptions);

    await dataSource.initialize();
    return dataSource;
  } catch (error) {
    Logger.error(`Database connection error: ${getErrorMessage(error)}`);
    return null;
  }
};
