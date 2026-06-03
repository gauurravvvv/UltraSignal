/**
 * openDatasourceConnection — single entry point for connecting to a
 * USER-CREATED external datasource (the customer's database, not our
 * master DB).
 *
 * Routes the connection based on `datasource.config.dbType`:
 *
 *   - 'snowflake'      → connectToSnowflake (snowflake-sdk path)
 *   - everything else  → getDbConnection (TypeORM path)
 *
 * Why this exists:
 *   Before this helper, every external-datasource call site (~25
 *   places across modules/datasources, datasets, dashboards, analyses,
 *   analysis-filters, prompts, queries) did the same dance: read the
 *   stored encrypted password, decryptForClient, hand off to
 *   getDbConnection. None of them branched on dbType — they assumed
 *   TypeORM. With Snowflake added, every one of those sites would
 *   need its own if/else to route to the right helper. This wrapper
 *   centralises the routing AND the password-decryption boilerplate.
 *
 * Returns a unified `DatasourceQueryConnection` interface that both
 * TypeORM's DataSource and SnowflakeConnectionAdapter satisfy —
 * `.query(sql, params?)` and `.destroy()`. Call sites stay engine-
 * agnostic. If a controller needs engine-specific behaviour later
 * (e.g. cancelQuery's `pg_terminate_backend`), it should branch on
 * dbType BEFORE calling this helper, not after.
 *
 * Returns `null` on connection failure — matches the existing
 * getDbConnection / connectToSnowflake contract so call sites can
 * still use `if (!conn) return 500;` boilerplate.
 *
 * MASTER DB:
 *   Do NOT use this for master-DB connections. Master-DB callers
 *   still use getDbConnection() directly with `isMasterDb: true` so
 *   the master schema gets pinned. This helper is for EXTERNAL
 *   datasources only.
 */
import {
  DB_SYNC,
  DB_TYPES,
  IS_MASTER_DB,
} from '../../../../config/config';
import { decryptForClient } from '../../services/crypto.service';
import { getDbConnection, SupportedDbType } from './getDbConnection';
import { connectToSnowflake } from './snowflakeConnection';

/**
 * Unified query/destroy interface that both TypeORM's DataSource and
 * SnowflakeConnectionAdapter expose. Call sites should type their
 * connection variable as this so they don't accidentally rely on
 * engine-specific methods (.getRepository(), .manager, etc. exist on
 * DataSource but NOT on SnowflakeConnectionAdapter).
 */
export interface DatasourceQueryConnection {
  // Return type intentionally `any` (not `any[]`) — matches TypeORM
  // DataSource's looser signature so callers that access engine-
  // specific properties on the result (e.g. PostgresQueryRunner's
  // `.raw.fields` for column metadata when the result set is empty)
  // continue to typecheck.
  query(sql: string, params?: unknown[]): Promise<any>;
  destroy(): Promise<void>;
}

/**
 * The client-config shape required for password decryption. Kept minimal
 * so call sites can pass `clientData.config` straight through without
 * worrying about the encryption-internal shape.
 */
type OrgConfigShape = { encryptedDek?: string | null } & Record<string, any>;

/**
 * Structural type covering both DatasourceConfigS (user-created
 * external datasource) and DatabaseConfig (a client's master DB record).
 * Both expose the same connection fields, so a single helper can take
 * either. Snowflake-specific fields (account/warehouse/role/schemaName)
 * are optional and only consulted when dbType === 'snowflake'.
 */
export interface DatasourceConfigLike {
  hostname: string;
  port: number;
  dbName: string;
  username: string;
  password: string;
  dbType?: string;
  account?: string;
  warehouse?: string;
  role?: string;
  schemaName?: string;
}

export const openDatasourceConnection = async (
  config: DatasourceConfigLike,
  clientConfig: OrgConfigShape,
): Promise<DatasourceQueryConnection | null> => {
  // Password is decrypted here once. Caller never sees the plaintext —
  // that responsibility moves out of every consumer.
  const password = decryptForClient(config.password, clientConfig);

  if (config.dbType === DB_TYPES.SNOWFLAKE) {
    // Snowflake path. The helper handles its own connection lifecycle;
    // we just hand it the credentials and the optional warehouse/role/
    // schema set from the datasource config.
    return connectToSnowflake({
      account: config.account ?? '',
      username: config.username,
      password,
      database: config.dbName,
      warehouse: config.warehouse,
      role: config.role,
      schema: config.schemaName,
    });
  }

  // TypeORM path. dbType is one of postgres / mysql / mariadb / mssql /
  // oracle. getDbConnection accepts these as its `dbType` arg and falls
  // back to 'postgres' for safety if the column ever holds an empty
  // string (shouldn't, but the entity default is 'postgres' so it can
  // happen with legacy rows).
  const dbType = (config.dbType || DB_TYPES.POSTGRES) as SupportedDbType;
  return getDbConnection(
    config.hostname,
    config.port,
    config.username,
    password,
    config.dbName,
    undefined, // entities — external datasources don't preload entities
    DB_SYNC.OFF, // sync — never sync external datasources
    dbType,
    IS_MASTER_DB.EXTERNAL, // isMasterDb — explicit false so master schema is NOT pinned
  );
};
