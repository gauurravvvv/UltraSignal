/**
 * testDatasourceConnection — verify a user-typed set of credentials
 * against an external datasource. Used by the connection module's
 * add + update controllers before saving the connection record, so
 * dead credentials never make it into the table.
 *
 * Same dbType routing as `openDatasourceConnection` — Snowflake
 * goes through `connectToSnowflake`, everything else through
 * `getDbConnection`. The key difference: this helper accepts a
 * PLAINTEXT password (the user just typed it into the form) and
 * skips `decryptForClient`. The companion `openDatasourceConnection`
 * stays the trusted decrypt-on-the-fly path for previously-saved
 * credentials.
 *
 * The connecting username swap is the caller's responsibility — pass
 * a `config` whose `username` field is the user-typed `dbUsername`,
 * not the parent datasource's admin username. All other fields
 * (host, port, dbName, dbType, account, warehouse, role,
 * schemaName) carry over from the parent datasource config so
 * Snowflake's session context (warehouse / role / schema) is set
 * exactly the way the eventual saved-connection use will set it.
 *
 * Return contract mirrors `openDatasourceConnection`:
 *   - non-null DatasourceQueryConnection on success — caller MUST
 *     `await conn.destroy()` after verifying. We never reuse the
 *     test connection; a fresh pool gets opened for real queries
 *     later via the standard `openDatasourceConnection` path.
 *   - null on failure — caller responds with the standard
 *     CONNECTION_MSG.TEST_FAILED.
 *
 * Why a separate helper instead of an `alreadyPlaintext` flag on
 * `openDatasourceConnection`: keeps the decrypt-on-the-fly contract
 * of that helper tight and audit-friendly. A future caller can't
 * accidentally pass a plaintext password where the system expects
 * encrypted (or vice versa) and silently get the wrong outcome.
 */
import {
  DB_SYNC,
  DB_TYPES,
  IS_MASTER_DB,
} from '../../../../config/config';
import {
  DatasourceConfigLike,
  DatasourceQueryConnection,
} from './openDatasourceConnection';
import { getDbConnection, SupportedDbType } from './getDbConnection';
import { connectToSnowflake } from './snowflakeConnection';

export const testDatasourceConnection = async (
  config: DatasourceConfigLike,
  plaintextPassword: string,
): Promise<DatasourceQueryConnection | null> => {
  if (config.dbType === DB_TYPES.SNOWFLAKE) {
    return connectToSnowflake({
      account: config.account ?? '',
      username: config.username,
      password: plaintextPassword,
      database: config.dbName,
      warehouse: config.warehouse,
      role: config.role,
      schema: config.schemaName,
    });
  }

  // TypeORM path — postgres / mysql / mariadb / mssql / oracle.
  // Default to 'postgres' to match `openDatasourceConnection` so
  // legacy datasource rows (created before the dbType column
  // existed) keep working.
  const dbType = (config.dbType || DB_TYPES.POSTGRES) as SupportedDbType;
  return getDbConnection(
    config.hostname,
    config.port,
    config.username,
    plaintextPassword,
    config.dbName,
    undefined, // entities
    DB_SYNC.OFF, // sync
    dbType,
    IS_MASTER_DB.EXTERNAL, // isMasterDb — never sync master schema on a credential test
  );
};
