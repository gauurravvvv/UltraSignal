/**
 * getDbActivity — queries `pg_stat_activity` and `pg_roles` on the connected datasource
 * to return active queries, connections, and role details.
 *
 * All three queries require `pg_monitor` or superuser privileges on the target database.
 * Each function catches privilege errors with `Logger.warn` and returns `[]` instead of
 * throwing — a restricted user can still see the activity page; it just shows empty lists
 * for the sections they can't access.
 *
 * `getDatabaseActivity` uses `Promise.allSettled` so a failure in one query doesn't
 * cancel the other two.
 */
import { DatasourceQueryConnection } from './openDatasourceConnection';
import Logger from '../../utility/logger/logger';
import { ACTIVE_CONNECTIONS, ACTIVE_QUERIES, ROLE_DETAILS } from './queries';

export const getActiveQueries = async (
  dbConnection: DatasourceQueryConnection,
): Promise<any[]> => {
  try {
    const result = await dbConnection.query(ACTIVE_QUERIES);
    return result.map((row: any) => ({
      pid: row.pid,
      username: row.username,
      datasourceName: row.database_name,
      clientAddress: row.client_address,
      applicationName: row.application_name,
      state: row.state,
      query: row.query,
      backendStart: row.backend_start,
      queryStart: row.query_start,
      stateChange: row.state_change,
      waitEventType: row.wait_event_type,
      waitEvent: row.wait_event,
      durationSeconds: parseFloat(row.duration_seconds) || 0,
    }));
  } catch (error) {
    Logger.warn('Failed to fetch active queries (insufficient privileges)');
    return [];
  }
};

export const getActiveConnections = async (
  dbConnection: DatasourceQueryConnection,
): Promise<any[]> => {
  try {
    const result = await dbConnection.query(ACTIVE_CONNECTIONS);
    return result.map((row: any) => ({
      pid: row.pid,
      username: row.username,
      datasourceName: row.database_name,
      clientAddress: row.client_address,
      clientPort: row.client_port,
      applicationName: row.application_name,
      state: row.state,
      backendStart: row.backend_start,
      stateChange: row.state_change,
      waitEventType: row.wait_event_type,
      waitEvent: row.wait_event,
      connectionAgeSeconds: parseFloat(row.connection_age_seconds) || 0,
      currentQuery: row.current_query,
    }));
  } catch (error) {
    Logger.warn('Failed to fetch active connections (insufficient privileges)');
    return [];
  }
};

export const getRoleDetails = async (
  dbConnection: DatasourceQueryConnection,
): Promise<any[]> => {
  try {
    const result = await dbConnection.query(ROLE_DETAILS);
    return result.map((row: any) => ({
      roleName: row.role_name,
      isSuperuser: row.is_superuser,
      canInherit: row.can_inherit,
      canCreateRole: row.can_create_role,
      canCreateDb: row.can_create_db,
      canLogin: row.can_login,
      isReplication: row.is_replication,
      connectionLimit: row.connection_limit,
      validUntil: row.valid_until,
      activeConnections: parseInt(row.active_connections) || 0,
      memberOf: row.member_of || [],
    }));
  } catch (error) {
    Logger.warn('Failed to fetch role details (insufficient privileges)');
    return [];
  }
};

export const getDatabaseActivity = async (
  dbConnection: DatasourceQueryConnection,
): Promise<{
  activeQueries: any[];
  activeConnections: any[];
  roles: any[];
}> => {
  const [queriesResult, connectionsResult, rolesResult] =
    await Promise.allSettled([
      getActiveQueries(dbConnection),
      getActiveConnections(dbConnection),
      getRoleDetails(dbConnection),
    ]);

  return {
    activeQueries:
      queriesResult.status === 'fulfilled' ? queriesResult.value : [],
    activeConnections:
      connectionsResult.status === 'fulfilled' ? connectionsResult.value : [],
    roles: rolesResult.status === 'fulfilled' ? rolesResult.value : [],
  };
};
