/**
 * queries — raw SQL constants for datasource introspection.
 *
 * All queries filter out `pg_catalog`, `information_schema`, `pg_%`, `typeorm_%`, and
 * `dbexec_%` schemas/tables so users only see their own data. Privilege gates
 * (`has_schema_privilege`, `has_table_privilege`) are included in every query so the
 * results are automatically scoped to what the connecting database user can actually
 * access — no application-level filtering needed.
 *
 * `GET_ALL_TABLE_IN_SCHEMA_DETAILS` and `GET_COLUMNS_IN_TABLE_DETAILS` use `{{...}}`
 * placeholders that must be replaced before execution (not parameterized) because
 * schema/table names can't be passed as `$1` parameters in `information_schema` queries.
 * Callers must sanitize these values before interpolation.
 *
 * Activity queries (`ACTIVE_QUERIES`, `ACTIVE_CONNECTIONS`) filter to `current_database()`
 * so they are scoped to the connected DB and exclude the monitoring connection itself
 * via `pid != pg_backend_pid()`.
 */
import { DB_TYPES } from '../../../../config/config';

export const GET_ALL_SCHEMA_DETAILS = `select
	ROW_NUMBER() OVER () AS id,
	nspname as name
from
	pg_catalog.pg_namespace
where
	nspname not like 'pg_%'
  and nspname not like 'typeorm_%'
  and nspname not like 'dbexec_%'
	and nspname <> 'information_schema'
	and has_schema_privilege(current_user, nspname, 'USAGE')
order by
	nspname`;

export const GET_ALL_TABLE_IN_SCHEMA_DETAILS = `select
	ROW_NUMBER() OVER () AS id,
	tablename as name
from
	pg_catalog.pg_tables
where
	schemaname = '{{SCHEMA_NAME}}' 
	and tablename not like 'typeorm%'
	and has_schema_privilege(current_user, schemaname, 'USAGE')
	and has_table_privilege(current_user, quote_ident(schemaname) || '.' || quote_ident(tablename), 'SELECT')`;

export const GET_COLUMNS_IN_TABLE_DETAILS = `select
	ROW_NUMBER() OVER () AS id,
	column_name as name
from
	information_schema.columns
where
	table_name = '{{TABLE_NAME}}'
AND table_schema = '{{SCHEMA_NAME}}'
AND has_schema_privilege(current_user, table_schema, 'USAGE')
AND has_table_privilege(current_user, quote_ident(table_schema) || '.' || quote_ident(table_name), 'SELECT')`;

export const GET_LIST_ROLE_DETAILS = `SELECT
    ROW_NUMBER() OVER () AS s_no,
    *
from
    pg_roles;`;

export const GET_DATABASE_SUMMARY_METRICS = `SELECT 
    ROUND(pg_database_size('{{DATABASE_NAME}}') / 1024.0 / 1024.0, 2) AS database_size,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')) AS total_tables,
    (SELECT COUNT(*) FROM information_schema.views WHERE table_schema NOT IN ('pg_catalog', 'information_schema')) AS total_views,
    (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema NOT IN ('pg_catalog', 'information_schema')) AS total_triggers,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname NOT IN ('pg_catalog', 'information_schema')) AS total_indexes;
`;

export const GET_TABLE_COMPINED_COUNT = `SELECT t.tablename AS table_name, COUNT(i.indexname) AS index_count, COUNT(c.column_name) AS column_count, s.n_live_tup AS record_count FROM  pg_tables t LEFT JOIN  pg_indexes i ON i.tablename = t.tablename LEFT JOIN  information_schema.columns c ON c.table_name = t.tablename LEFT JOIN  pg_stat_user_tables s ON s.relname = t.tablename WHERE  t.schemaname NOT IN ('pg_catalog', 'information_schema') GROUP BY  t.tablename, s.n_live_tup ORDER BY  record_count DESC;`;

export const SCHEMA_STATS = `SELECT 
        n.nspname AS "SchemaName",
        (SELECT COUNT(*) FROM information_schema.tables t 
         WHERE t.table_schema = n.nspname 
         AND table_type = 'BASE TABLE'
         AND t.table_name NOT LIKE 'typeorm_%') as "TableCount",
        (SELECT COUNT(*) FROM information_schema.views v 
         WHERE v.table_schema = n.nspname) as "ViewCount",
        (SELECT COUNT(*) FROM information_schema.routines r 
         WHERE r.specific_schema = n.nspname 
         AND routine_type = 'FUNCTION') as "FunctionCount",
        COALESCE(SUM(
          CASE 
            WHEN c.relname NOT LIKE 'typeorm_%' 
            THEN pg_total_relation_size(quote_ident(n.nspname) || '.' || quote_ident(c.relname))::float/1024/1024 
            ELSE 0 
          END
        ), 0) as "TotalSizeMB"
      FROM pg_namespace n
      LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relkind = 'r'
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname NOT LIKE 'pg_%'
      AND has_schema_privilege(current_user, n.nspname, 'USAGE')
      GROUP BY n.nspname`;

export const TABLE_STATS = `SELECT 
        t.table_schema AS "SchemaName",
        t.table_name AS "TableName",
        COALESCE(s.n_live_tup, 0) AS "RowCounts",
        (
          SELECT COUNT(column_name) 
          FROM information_schema.columns 
          WHERE table_schema = t.table_schema 
          AND table_name = t.table_name
        ) AS "TotalColumns",
        (
          SELECT COUNT(1) 
          FROM pg_indexes 
          WHERE schemaname = t.table_schema 
          AND tablename = t.table_name
        ) AS "TotalIndexes",
        pg_total_relation_size(quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))::float/1024/1024 AS "TotalSpaceMB",
        pg_table_size(quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))::float/1024/1024 AS "UsedSpaceMB",
        (pg_total_relation_size(quote_ident(t.table_schema) || '.' || quote_ident(t.table_name)) - 
         pg_table_size(quote_ident(t.table_schema) || '.' || quote_ident(t.table_name)))::float/1024/1024 AS "UnusedSpaceMB"
      FROM 
        information_schema.tables t
        JOIN pg_class c ON c.relname = t.table_name
        LEFT JOIN pg_stat_user_tables s ON s.schemaname = t.table_schema AND s.relname = t.table_name
      WHERE 
        t.table_schema NOT IN ('pg_catalog', 'information_schema')
        AND t.table_schema NOT LIKE 'pg_%'
        AND t.table_type = 'BASE TABLE'
        AND t.table_name NOT LIKE 'typeorm_%'
        AND c.relkind = 'r'
        AND has_schema_privilege(current_user, t.table_schema, 'USAGE')
        AND has_table_privilege(current_user, quote_ident(t.table_schema) || '.' || quote_ident(t.table_name), 'SELECT')`;

export const DB_SUMMARY = `SELECT 
        (
          SELECT COUNT(DISTINCT n.nspname) 
          FROM pg_namespace n
          WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
          AND n.nspname NOT LIKE 'pg_%'
          AND has_schema_privilege(current_user, n.nspname, 'USAGE')
        ) as "TotalSchemas",
        (
          SELECT COUNT(*) 
          FROM information_schema.tables t
          WHERE t.table_type = 'BASE TABLE'
          AND t.table_schema NOT IN ('pg_catalog', 'information_schema')
          AND t.table_schema NOT LIKE 'pg_%'
          AND t.table_name NOT LIKE 'typeorm_%'
          AND has_schema_privilege(current_user, t.table_schema, 'USAGE')
          AND has_table_privilege(current_user, quote_ident(t.table_schema) || '.' || quote_ident(t.table_name), 'SELECT')
        ) as "TotalTables",
        (
          SELECT COUNT(*) 
          FROM pg_indexes i
          JOIN information_schema.tables t ON t.table_schema = i.schemaname AND t.table_name = i.tablename
          WHERE i.schemaname NOT IN ('pg_catalog', 'information_schema')
          AND i.schemaname NOT LIKE 'pg_%'
          AND i.tablename NOT LIKE 'typeorm_%'
          AND has_schema_privilege(current_user, i.schemaname, 'USAGE')
          AND has_table_privilege(current_user, quote_ident(i.schemaname) || '.' || quote_ident(i.tablename), 'SELECT')
        ) as "TotalIndexes",
        (
          SELECT COUNT(*) 
          FROM information_schema.views v
          WHERE v.table_schema NOT IN ('pg_catalog', 'information_schema')
          AND v.table_schema NOT LIKE 'pg_%'
          AND has_schema_privilege(current_user, v.table_schema, 'USAGE')
          AND has_table_privilege(current_user, quote_ident(v.table_schema) || '.' || quote_ident(v.table_name), 'SELECT')
        ) as "TotalViews",
        (
          SELECT COUNT(*) 
          FROM information_schema.triggers tr
          JOIN information_schema.tables t ON t.table_schema = tr.event_object_schema AND t.table_name = tr.event_object_table
          WHERE tr.trigger_schema NOT IN ('pg_catalog', 'information_schema')
          AND tr.trigger_schema NOT LIKE 'pg_%'
          AND has_schema_privilege(current_user, tr.trigger_schema, 'USAGE')
          AND has_table_privilege(current_user, quote_ident(tr.event_object_schema) || '.' || quote_ident(tr.event_object_table), 'SELECT')
        ) as "TotalTriggers",
        pg_database_size(current_database())::float/1024/1024 as "DatasourceSizeMB"`;

export const GET_ALL_SCHEMA_TABLES_COLUMNS = `
  WITH table_columns AS (
    SELECT 
      c.table_schema,
      c.table_name,
      json_agg(
        json_build_object(
          'column_name', c.column_name,
          'data_type', c.data_type,
          'is_nullable', c.is_nullable,
          'column_default', c.column_default
        ) ORDER BY c.ordinal_position
      ) as columns
    FROM information_schema.columns c
    WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
      AND c.table_schema NOT LIKE 'pg_%'
      AND c.table_schema NOT LIKE 'typeorm_%'
      AND c.table_schema NOT LIKE 'dbexec_%'
      AND c.table_name NOT LIKE 'typeorm%'
      AND has_schema_privilege(current_user, c.table_schema, 'USAGE')
      AND has_table_privilege(current_user, quote_ident(c.table_schema) || '.' || quote_ident(c.table_name), 'SELECT')
    GROUP BY c.table_schema, c.table_name
)
SELECT 
  n.nspname AS schema_name,
  json_agg(
    json_build_object(
      'table_name', t.relname,
      'table_alias', lower(substr(t.relname, 1, 3)) || '_' || substr(md5(n.nspname || '.' || t.relname), 1, 3),
      'columns', tc.columns
    ) ORDER BY t.relname
  ) AS tables
FROM pg_catalog.pg_namespace n
JOIN pg_catalog.pg_class t ON t.relnamespace = n.oid
LEFT JOIN table_columns tc 
       ON tc.table_schema = n.nspname 
      AND tc.table_name = t.relname
WHERE 
  n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_%'
  AND n.nspname NOT LIKE 'typeorm_%'
  AND n.nspname NOT LIKE 'dbexec_%'
  AND t.relkind = 'r'
  AND t.relname NOT LIKE 'typeorm%'
  AND has_schema_privilege(current_user, n.nspname, 'USAGE')
  AND has_table_privilege(current_user, quote_ident(n.nspname) || '.' || quote_ident(t.relname), 'SELECT')
GROUP BY n.nspname
ORDER BY n.nspname;
`;

export const ACTIVE_QUERIES = `SELECT
  pid, usename AS username, datname AS database_name,
  client_addr AS client_address, application_name, state, query,
  backend_start, query_start, state_change, wait_event_type, wait_event,
  EXTRACT(EPOCH FROM (now() - query_start))::numeric(10,2) AS duration_seconds
FROM pg_stat_activity
WHERE state != 'idle' AND pid != pg_backend_pid() AND datname = current_database()
ORDER BY duration_seconds DESC NULLS LAST`;

export const ACTIVE_CONNECTIONS = `SELECT
  pid, usename AS username, datname AS database_name,
  client_addr AS client_address, client_port, application_name, state,
  backend_start, state_change, wait_event_type, wait_event,
  EXTRACT(EPOCH FROM (now() - backend_start))::numeric(10,2) AS connection_age_seconds,
  CASE WHEN state = 'active' THEN query ELSE NULL END AS current_query
FROM pg_stat_activity
WHERE pid != pg_backend_pid() AND datname = current_database()
ORDER BY backend_start ASC`;

export const ROLE_DETAILS = `SELECT
  r.rolname AS role_name, r.rolsuper AS is_superuser, r.rolinherit AS can_inherit,
  r.rolcreaterole AS can_create_role, r.rolcreatedb AS can_create_db,
  r.rolcanlogin AS can_login, r.rolreplication AS is_replication,
  r.rolconnlimit AS connection_limit, r.rolvaliduntil AS valid_until,
  COALESCE(c.connection_count, 0) AS active_connections,
  ARRAY(SELECT b.rolname FROM pg_catalog.pg_auth_members m
    JOIN pg_catalog.pg_roles b ON m.roleid = b.oid WHERE m.member = r.oid) AS member_of
FROM pg_catalog.pg_roles r
LEFT JOIN (SELECT usename, COUNT(*) AS connection_count FROM pg_stat_activity
  WHERE datname = current_database() GROUP BY usename) c ON c.usename = r.rolname
WHERE r.rolname NOT LIKE 'pg_%'
ORDER BY r.rolcanlogin DESC, r.rolname ASC`;

// ───────────────────────────────────────────────────────────────────────
// Dialect-aware introspection queries
//
// Three families: list schemas in a datasource, list tables in a schema,
// list columns in a table. One query per supported dbType. Power the
// lazy schema sidebar: each click on a tree node makes one targeted
// round-trip rather than fetching the entire tree up front.
//
// Parameter binding differs per driver:
//   - Postgres / Snowflake (snowflake-sdk): `$1`-style positional.
//   - MySQL / MariaDB / MSSQL / Oracle (mssql/oracledb via TypeORM): `?`
//     placeholders. TypeORM's DataSource.query() with the second `params`
//     argument normalises this automatically across all three drivers,
//     so we use `?` here and let the driver translate.
//
// System-schema exclusion is dialect-specific:
//   - Postgres: pg_catalog, information_schema, pg_toast, pg_temp_*,
//     pg_toast_temp_*, plus the platform-internal typeorm_* / dbexec_*
//     namespaces.
//   - MySQL/MariaDB: mysql, performance_schema, information_schema, sys.
//   - MSSQL: sys, INFORMATION_SCHEMA, db_*, guest, INFORMATION_SCHEMA.
//   - Oracle: SYS, SYSTEM, OUTLN, DBSNMP, XDB, APEX_*, FLOWS_*, MDSYS,
//     CTXSYS, ORDDATA, ORDSYS, SI_INFORMTN_SCHEMA, WMSYS, XS$NULL, GSMADMIN
//     _INTERNAL, AUDSYS, GSMUSER, GSMCATUSER, REMOTE_SCHEDULER_AGENT,
//     ANONYMOUS, APPQOSSYS, DIP, MDDATA, ORACLE_OCM, SYSBACKUP, SYSDG,
//     SYSKM, SYSRAC, LBACSYS, DVF, DVSYS, GGSYS.
//   - Snowflake: INFORMATION_SCHEMA itself (per database, not per schema).
//
// Postgres adds privilege-gate predicates (has_schema_privilege /
// has_table_privilege) so users only see what the connecting DB user
// can actually SELECT. Other engines rely on information_schema's
// own privilege-aware row visibility.

/** Supported engine keys. Mirrors DatasourceConfigS.dbType — derived
 *  from the shared `DB_TYPES` constant so a new engine added there
 *  is automatically required here. */
export type IntrospectionDbType = (typeof DB_TYPES)[keyof typeof DB_TYPES];

/** List user-visible schemas in the active database. Each query returns
 *  rows shaped `{ schema_name: string }`. */
export const INTRO_SCHEMAS_BY_DBTYPE: Record<IntrospectionDbType, string> = {
  postgres: `
    SELECT nspname AS schema_name
    FROM pg_catalog.pg_namespace
    WHERE nspname NOT IN ('pg_catalog', 'information_schema')
      AND nspname NOT LIKE 'pg_%'
      AND nspname NOT LIKE 'typeorm_%'
      AND nspname NOT LIKE 'dbexec_%'
      AND has_schema_privilege(current_user, nspname, 'USAGE')
    ORDER BY nspname
  `,
  // MySQL / MariaDB call databases "schemata" in information_schema.
  mysql: `
    SELECT schema_name AS schema_name
    FROM information_schema.schemata
    WHERE schema_name NOT IN ('mysql', 'performance_schema', 'information_schema', 'sys')
    ORDER BY schema_name
  `,
  mariadb: `
    SELECT schema_name AS schema_name
    FROM information_schema.schemata
    WHERE schema_name NOT IN ('mysql', 'performance_schema', 'information_schema', 'sys')
    ORDER BY schema_name
  `,
  mssql: `
    SELECT name AS schema_name
    FROM sys.schemas
    WHERE name NOT IN ('sys','INFORMATION_SCHEMA','guest','db_owner','db_accessadmin',
                       'db_securityadmin','db_ddladmin','db_backupoperator',
                       'db_datareader','db_datawriter','db_denydatareader',
                       'db_denydatawriter')
    ORDER BY name
  `,
  oracle: `
    SELECT username AS schema_name
    FROM all_users
    WHERE username NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','XDB','MDSYS','CTXSYS',
                           'ORDDATA','ORDSYS','SI_INFORMTN_SCHEMA','WMSYS','XS$NULL',
                           'GSMADMIN_INTERNAL','AUDSYS','GSMUSER','GSMCATUSER',
                           'REMOTE_SCHEDULER_AGENT','ANONYMOUS','APPQOSSYS','DIP',
                           'MDDATA','ORACLE_OCM','SYSBACKUP','SYSDG','SYSKM','SYSRAC',
                           'LBACSYS','DVF','DVSYS','GGSYS','OJVMSYS','ORDPLUGINS',
                           'OLAPSYS','DBSFWUSER')
      AND username NOT LIKE 'APEX_%'
      AND username NOT LIKE 'FLOWS_%'
    ORDER BY username
  `,
  // Snowflake: per-database query. Caller must already be on the right
  // database (set via USE DATABASE or in the connection options).
  snowflake: `
    SELECT schema_name AS schema_name
    FROM information_schema.schemata
    WHERE schema_name <> 'INFORMATION_SCHEMA'
    ORDER BY schema_name
  `,
};

/** List tables in a given schema. Param 1 = schema name. Each query
 *  returns rows shaped `{ table_name: string }`. */
export const INTRO_TABLES_BY_DBTYPE: Record<IntrospectionDbType, string> = {
  postgres: `
    SELECT t.tablename AS table_name
    FROM pg_catalog.pg_tables t
    WHERE t.schemaname = $1
      AND t.tablename NOT LIKE 'typeorm%'
      AND has_table_privilege(
        current_user,
        quote_ident(t.schemaname) || '.' || quote_ident(t.tablename),
        'SELECT'
      )
    UNION ALL
    SELECT v.viewname AS table_name
    FROM pg_catalog.pg_views v
    WHERE v.schemaname = $1
      AND has_table_privilege(
        current_user,
        quote_ident(v.schemaname) || '.' || quote_ident(v.viewname),
        'SELECT'
      )
    ORDER BY table_name
  `,
  mysql: `
    SELECT table_name AS table_name
    FROM information_schema.tables
    WHERE table_schema = ?
    ORDER BY table_name
  `,
  mariadb: `
    SELECT table_name AS table_name
    FROM information_schema.tables
    WHERE table_schema = ?
    ORDER BY table_name
  `,
  mssql: `
    SELECT t.name AS table_name
    FROM sys.tables t
    INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = @0
    UNION ALL
    SELECT v.name AS table_name
    FROM sys.views v
    INNER JOIN sys.schemas s ON s.schema_id = v.schema_id
    WHERE s.name = @0
    ORDER BY table_name
  `,
  oracle: `
    SELECT object_name AS table_name
    FROM all_objects
    WHERE owner = :1
      AND object_type IN ('TABLE','VIEW','MATERIALIZED VIEW')
    ORDER BY object_name
  `,
  snowflake: `
    SELECT table_name AS table_name
    FROM information_schema.tables
    WHERE table_schema = ?
    ORDER BY table_name
  `,
};

/** List columns in a given table. Params: 1 = schema name, 2 = table
 *  name. Each query returns rows shaped
 *  `{ column_name, data_type, is_nullable, column_default }`. */
export const INTRO_COLUMNS_BY_DBTYPE: Record<IntrospectionDbType, string> = {
  postgres: `
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name = $2
    ORDER BY ordinal_position
  `,
  mysql: `
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = ?
      AND table_name = ?
    ORDER BY ordinal_position
  `,
  mariadb: `
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = ?
      AND table_name = ?
    ORDER BY ordinal_position
  `,
  mssql: `
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = @0
      AND table_name = @1
    ORDER BY ordinal_position
  `,
  oracle: `
    SELECT
      column_name AS "column_name",
      data_type AS "data_type",
      CASE WHEN nullable = 'Y' THEN 'YES' ELSE 'NO' END AS "is_nullable",
      data_default AS "column_default"
    FROM all_tab_columns
    WHERE owner = :1
      AND table_name = :2
    ORDER BY column_id
  `,
  snowflake: `
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = ?
      AND table_name = ?
    ORDER BY ordinal_position
  `,
};

/**
 * Whole-datasource introspection — one query per dialect that returns
 * every column the connecting user can see, with its schema + table.
 * Result rows are flat `{schema_name, table_name, column_name,
 * data_type, is_nullable, column_default, ordinal_position}` — the
 * caller groups them into the nested
 * `[{schema_name, tables:[{table_name, columns:[…]}]}]` shape.
 *
 * Why flat: most engines can't aggregate JSON the way Postgres can,
 * and the engines that can (mssql, oracle 19+) need radically
 * different syntax. A flat shape ships in one round-trip per dialect
 * without dialect-specific JSON gymnastics; grouping in JS is cheap
 * even for tens of thousands of rows.
 *
 * Privilege gating: Postgres adds has_table_privilege so users only
 * see columns of tables they can SELECT. Other engines rely on
 * information_schema's privilege-aware row visibility — the
 * connecting user already can't see what they can't SELECT.
 *
 * System-schema exclusions match `INTRO_SCHEMAS_BY_DBTYPE` so the
 * "all schemas" tree doesn't surface engine internals.
 */
export const INTRO_FULL_STRUCTURE_BY_DBTYPE: Record<
  IntrospectionDbType,
  string
> = {
  postgres: `
    SELECT
      c.table_schema     AS schema_name,
      c.table_name       AS table_name,
      c.column_name      AS column_name,
      c.data_type        AS data_type,
      c.is_nullable      AS is_nullable,
      c.column_default   AS column_default,
      c.ordinal_position AS ordinal_position
    FROM information_schema.columns c
    WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
      AND c.table_schema NOT LIKE 'pg_%'
      AND c.table_schema NOT LIKE 'typeorm_%'
      AND c.table_schema NOT LIKE 'dbexec_%'
      AND has_schema_privilege(current_user, c.table_schema, 'USAGE')
      AND has_table_privilege(
        current_user,
        quote_ident(c.table_schema) || '.' || quote_ident(c.table_name),
        'SELECT'
      )
      AND c.table_name NOT LIKE 'typeorm%'
    ORDER BY c.table_schema, c.table_name, c.ordinal_position
  `,
  mysql: `
    SELECT
      c.table_schema     AS schema_name,
      c.table_name       AS table_name,
      c.column_name      AS column_name,
      c.data_type        AS data_type,
      c.is_nullable      AS is_nullable,
      c.column_default   AS column_default,
      c.ordinal_position AS ordinal_position
    FROM information_schema.columns c
    WHERE c.table_schema NOT IN ('mysql', 'performance_schema', 'information_schema', 'sys')
    ORDER BY c.table_schema, c.table_name, c.ordinal_position
  `,
  mariadb: `
    SELECT
      c.table_schema     AS schema_name,
      c.table_name       AS table_name,
      c.column_name      AS column_name,
      c.data_type        AS data_type,
      c.is_nullable      AS is_nullable,
      c.column_default   AS column_default,
      c.ordinal_position AS ordinal_position
    FROM information_schema.columns c
    WHERE c.table_schema NOT IN ('mysql', 'performance_schema', 'information_schema', 'sys')
    ORDER BY c.table_schema, c.table_name, c.ordinal_position
  `,
  mssql: `
    SELECT
      c.table_schema     AS schema_name,
      c.table_name       AS table_name,
      c.column_name      AS column_name,
      c.data_type        AS data_type,
      c.is_nullable      AS is_nullable,
      c.column_default   AS column_default,
      c.ordinal_position AS ordinal_position
    FROM information_schema.columns c
    WHERE c.table_schema NOT IN ('sys','INFORMATION_SCHEMA','guest','db_owner','db_accessadmin',
                                 'db_securityadmin','db_ddladmin','db_backupoperator',
                                 'db_datareader','db_datawriter','db_denydatareader',
                                 'db_denydatawriter')
    ORDER BY c.table_schema, c.table_name, c.ordinal_position
  `,
  oracle: `
    SELECT
      owner          AS "schema_name",
      table_name     AS "table_name",
      column_name    AS "column_name",
      data_type      AS "data_type",
      CASE WHEN nullable = 'Y' THEN 'YES' ELSE 'NO' END AS "is_nullable",
      data_default   AS "column_default",
      column_id      AS "ordinal_position"
    FROM all_tab_columns
    WHERE owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','XDB','MDSYS','CTXSYS',
                        'ORDDATA','ORDSYS','SI_INFORMTN_SCHEMA','WMSYS','XS$NULL',
                        'GSMADMIN_INTERNAL','AUDSYS','GSMUSER','GSMCATUSER',
                        'REMOTE_SCHEDULER_AGENT','ANONYMOUS','APPQOSSYS','DIP',
                        'MDDATA','ORACLE_OCM','SYSBACKUP','SYSDG','SYSKM','SYSRAC',
                        'LBACSYS','DVF','DVSYS','GGSYS','OJVMSYS','ORDPLUGINS',
                        'OLAPSYS','DBSFWUSER')
      AND owner NOT LIKE 'APEX_%'
      AND owner NOT LIKE 'FLOWS_%'
    ORDER BY owner, table_name, column_id
  `,
  snowflake: `
    SELECT
      c.table_schema     AS schema_name,
      c.table_name       AS table_name,
      c.column_name      AS column_name,
      c.data_type        AS data_type,
      c.is_nullable      AS is_nullable,
      c.column_default   AS column_default,
      c.ordinal_position AS ordinal_position
    FROM information_schema.columns c
    WHERE c.table_schema <> 'INFORMATION_SCHEMA'
    ORDER BY c.table_schema, c.table_name, c.ordinal_position
  `,
};

/**
 * Cheap row-count probe used to decide whether to ship the full
 * (schemas + tables + columns) tree or degrade to a lighter shape
 * (schemas + tables only, columns lazy on expand). One query per
 * dialect against the same information_schema view the full intro
 * uses, so the predicate matches exactly. Returns a single row
 * shaped `{ total: number }`.
 */
export const INTRO_COLUMN_COUNT_BY_DBTYPE: Record<IntrospectionDbType, string> =
  {
    postgres: `
    SELECT COUNT(*)::bigint AS total
    FROM information_schema.columns c
    WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
      AND c.table_schema NOT LIKE 'pg_%'
      AND c.table_schema NOT LIKE 'typeorm_%'
      AND c.table_schema NOT LIKE 'dbexec_%'
      AND has_schema_privilege(current_user, c.table_schema, 'USAGE')
      AND has_table_privilege(
        current_user,
        quote_ident(c.table_schema) || '.' || quote_ident(c.table_name),
        'SELECT'
      )
      AND c.table_name NOT LIKE 'typeorm%'
  `,
    mysql: `
    SELECT COUNT(*) AS total
    FROM information_schema.columns c
    WHERE c.table_schema NOT IN ('mysql', 'performance_schema', 'information_schema', 'sys')
  `,
    mariadb: `
    SELECT COUNT(*) AS total
    FROM information_schema.columns c
    WHERE c.table_schema NOT IN ('mysql', 'performance_schema', 'information_schema', 'sys')
  `,
    mssql: `
    SELECT COUNT(*) AS total
    FROM information_schema.columns c
    WHERE c.table_schema NOT IN ('sys','INFORMATION_SCHEMA','guest','db_owner','db_accessadmin',
                                 'db_securityadmin','db_ddladmin','db_backupoperator',
                                 'db_datareader','db_datawriter','db_denydatareader',
                                 'db_denydatawriter')
  `,
    oracle: `
    SELECT COUNT(*) AS "total"
    FROM all_tab_columns
    WHERE owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','XDB','MDSYS','CTXSYS',
                        'ORDDATA','ORDSYS','SI_INFORMTN_SCHEMA','WMSYS','XS$NULL',
                        'GSMADMIN_INTERNAL','AUDSYS','GSMUSER','GSMCATUSER',
                        'REMOTE_SCHEDULER_AGENT','ANONYMOUS','APPQOSSYS','DIP',
                        'MDDATA','ORACLE_OCM','SYSBACKUP','SYSDG','SYSKM','SYSRAC',
                        'LBACSYS','DVF','DVSYS','GGSYS','OJVMSYS','ORDPLUGINS',
                        'OLAPSYS','DBSFWUSER')
      AND owner NOT LIKE 'APEX_%'
      AND owner NOT LIKE 'FLOWS_%'
  `,
    snowflake: `
    SELECT COUNT(*) AS total
    FROM information_schema.columns c
    WHERE c.table_schema <> 'INFORMATION_SCHEMA'
  `,
  };

/**
 * Lazy-mode fallback: schemas + tables only, no columns. Used when
 * the column-count probe trips the size threshold. Columns are
 * fetched per-table on first expand via `INTRO_COLUMNS_BY_DBTYPE`.
 *
 * Same dialect coverage and system-schema exclusions as the full
 * intro map; just a smaller projection so the response stays under
 * a few megabytes even on warehouse-scale databases.
 *
 * Returns flat rows `{ schema_name, table_name }` — the caller
 * groups by schema.
 */
export const INTRO_SCHEMAS_AND_TABLES_BY_DBTYPE: Record<
  IntrospectionDbType,
  string
> = {
  postgres: `
    SELECT
      t.schemaname AS schema_name,
      t.tablename  AS table_name
    FROM pg_catalog.pg_tables t
    WHERE t.schemaname NOT IN ('pg_catalog', 'information_schema')
      AND t.schemaname NOT LIKE 'pg_%'
      AND t.schemaname NOT LIKE 'typeorm_%'
      AND t.schemaname NOT LIKE 'dbexec_%'
      AND has_schema_privilege(current_user, t.schemaname, 'USAGE')
      AND has_table_privilege(
        current_user,
        quote_ident(t.schemaname) || '.' || quote_ident(t.tablename),
        'SELECT'
      )
      AND t.tablename NOT LIKE 'typeorm%'
    UNION ALL
    SELECT
      v.schemaname AS schema_name,
      v.viewname   AS table_name
    FROM pg_catalog.pg_views v
    WHERE v.schemaname NOT IN ('pg_catalog', 'information_schema')
      AND v.schemaname NOT LIKE 'pg_%'
      AND v.schemaname NOT LIKE 'typeorm_%'
      AND v.schemaname NOT LIKE 'dbexec_%'
      AND has_schema_privilege(current_user, v.schemaname, 'USAGE')
      AND has_table_privilege(
        current_user,
        quote_ident(v.schemaname) || '.' || quote_ident(v.viewname),
        'SELECT'
      )
    ORDER BY schema_name, table_name
  `,
  mysql: `
    SELECT
      t.table_schema AS schema_name,
      t.table_name   AS table_name
    FROM information_schema.tables t
    WHERE t.table_schema NOT IN ('mysql', 'performance_schema', 'information_schema', 'sys')
    ORDER BY t.table_schema, t.table_name
  `,
  mariadb: `
    SELECT
      t.table_schema AS schema_name,
      t.table_name   AS table_name
    FROM information_schema.tables t
    WHERE t.table_schema NOT IN ('mysql', 'performance_schema', 'information_schema', 'sys')
    ORDER BY t.table_schema, t.table_name
  `,
  mssql: `
    SELECT
      s.name AS schema_name,
      t.name AS table_name
    FROM sys.tables t
    INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name NOT IN ('sys','INFORMATION_SCHEMA','guest','db_owner','db_accessadmin',
                         'db_securityadmin','db_ddladmin','db_backupoperator',
                         'db_datareader','db_datawriter','db_denydatareader',
                         'db_denydatawriter')
    UNION ALL
    SELECT
      s.name AS schema_name,
      v.name AS table_name
    FROM sys.views v
    INNER JOIN sys.schemas s ON s.schema_id = v.schema_id
    WHERE s.name NOT IN ('sys','INFORMATION_SCHEMA','guest','db_owner','db_accessadmin',
                         'db_securityadmin','db_ddladmin','db_backupoperator',
                         'db_datareader','db_datawriter','db_denydatareader',
                         'db_denydatawriter')
    ORDER BY schema_name, table_name
  `,
  oracle: `
    SELECT
      owner       AS "schema_name",
      object_name AS "table_name"
    FROM all_objects
    WHERE owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','XDB','MDSYS','CTXSYS',
                        'ORDDATA','ORDSYS','SI_INFORMTN_SCHEMA','WMSYS','XS$NULL',
                        'GSMADMIN_INTERNAL','AUDSYS','GSMUSER','GSMCATUSER',
                        'REMOTE_SCHEDULER_AGENT','ANONYMOUS','APPQOSSYS','DIP',
                        'MDDATA','ORACLE_OCM','SYSBACKUP','SYSDG','SYSKM','SYSRAC',
                        'LBACSYS','DVF','DVSYS','GGSYS','OJVMSYS','ORDPLUGINS',
                        'OLAPSYS','DBSFWUSER')
      AND owner NOT LIKE 'APEX_%'
      AND owner NOT LIKE 'FLOWS_%'
      AND object_type IN ('TABLE','VIEW','MATERIALIZED VIEW')
    ORDER BY owner, object_name
  `,
  snowflake: `
    SELECT
      t.table_schema AS schema_name,
      t.table_name   AS table_name
    FROM information_schema.tables t
    WHERE t.table_schema <> 'INFORMATION_SCHEMA'
    ORDER BY t.table_schema, t.table_name
  `,
};

/**
 * Threshold (in total column count across all user-visible tables)
 * above which `getDatasourceStructure` degrades from eager (full
 * tree) to lazy (schemas + tables only, columns on expand). Sized
 * so the eager response stays under a few megabytes on the wire
 * and Monaco IntelliSense's lookup builds in well under a second.
 *
 * Warehouse-scale databases (hundreds of schemas × hundreds of
 * tables × thousands of columns) trip this and use the lighter
 * shape — completion still works, just with a per-table fetch on
 * first column reference.
 */
export const SCHEMA_TREE_EAGER_COLUMN_LIMIT = 20_000;

/**
 * Normalise a stored dbType into the keys our intro maps recognise.
 * Falls back to 'postgres' for unknown values so legacy datasources
 * (created before the dbType column was added) keep working.
 */
export function resolveIntrospectionDbType(
  dbType: string | null | undefined,
): IntrospectionDbType {
  switch (dbType) {
    case DB_TYPES.MYSQL:
    case DB_TYPES.MARIADB:
    case DB_TYPES.MSSQL:
    case DB_TYPES.ORACLE:
    case DB_TYPES.SNOWFLAKE:
    case DB_TYPES.POSTGRES:
      return dbType;
    default:
      return DB_TYPES.POSTGRES;
  }
}
