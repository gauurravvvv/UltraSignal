/**
 * queryDialect — per-dialect SQL fragments for the user-query path
 * (executeQuery + exportQuery + cancelQuery). Centralised here so
 * no controller hand-rolls `EXPLAIN` / `ILIKE` / `$N` placeholder
 * choices that only work on Postgres.
 *
 * Six dialects: postgres, mysql, mariadb, mssql, oracle, snowflake.
 * Reuses `IntrospectionDbType` + `resolveIntrospectionDbType` from
 * queries.ts so legacy dbType strings still resolve cleanly.
 *
 * The helpers are pure (string in → string + params out). All call
 * sites pass parameters via the returned `params` array; never
 * inline user input into the SQL — even for KILL where placeholders
 * aren't accepted, the caller validates the id with a strict numeric
 * regex first (cancelQuery does this).
 */
import { DB_TYPES } from '../../../../config/config';
import { IntrospectionDbType, resolveIntrospectionDbType } from './queries';

/** Convenience re-export so callers can grab both helpers from
 *  one module without a separate import of queries.ts. */
export { IntrospectionDbType, resolveIntrospectionDbType };

/**
 * Quote an identifier (column or table name) for the given engine.
 * The user query itself isn't touched — this is for column names
 * we splice into filter / count / pagination wrappers. We pre-
 * validate column names against the result-set's `columns` list,
 * but defence-in-depth says we still strip embedded close-quotes.
 */
export function escapeIdentifier(
  name: string,
  dbType: string | null | undefined,
): string {
  const t = resolveIntrospectionDbType(dbType);
  // Reject anything that looks like an injection attempt. Column
  // names from real result sets never contain these characters.
  // Caller has already verified the name appears in the user's
  // result columns, so this is belt-and-braces.
  const safe = String(name).replace(/[`"\[\]\\]/g, '');
  switch (t) {
    case DB_TYPES.MYSQL:
    case DB_TYPES.MARIADB:
      return `\`${safe}\``;
    case DB_TYPES.MSSQL:
      return `[${safe}]`;
    case DB_TYPES.ORACLE:
    case DB_TYPES.POSTGRES:
    case DB_TYPES.SNOWFLAKE:
    default:
      return `"${safe}"`;
  }
}

/**
 * Parameter placeholder for the i-th param (1-indexed). The
 * caller is responsible for keeping its `params` array in the
 * same order as the placeholders it emits.
 *
 * mssql via TypeORM's mssql driver uses `@0, @1, …` (zero-indexed),
 * even though SQL Server's native syntax is `@p0`. The TypeORM
 * driver does the mapping for us, so callers pass the params
 * array in order and we emit `@0, @1, …`.
 */
export function placeholder(
  i: number,
  dbType: string | null | undefined,
): string {
  const t = resolveIntrospectionDbType(dbType);
  switch (t) {
    case DB_TYPES.POSTGRES:
      return `$${i}`;
    case DB_TYPES.ORACLE:
      return `:${i}`;
    case DB_TYPES.MSSQL:
      return `@${i - 1}`;
    case DB_TYPES.MYSQL:
    case DB_TYPES.MARIADB:
    case DB_TYPES.SNOWFLAKE:
    default:
      return `?`;
  }
}

/**
 * Build a single LIKE-style filter predicate for the given column.
 * The user's filter input is wrapped in `%…%` at the call site
 * (added to `params`), so this helper only emits the SQL fragment.
 *
 * Case-folding per engine:
 *   - postgres / snowflake: native ILIKE (case-insensitive).
 *   - mysql / mariadb: LIKE on default collation is CI.
 *   - mssql: LIKE on default collation is CI.
 *   - oracle: LIKE is CS by default; wrap both sides in UPPER().
 *     The caller is responsible for UPPER-ing the param value too
 *     so the wildcard wrapping survives — see mapFilterOperator's
 *     `paramTransform` field.
 */
export interface FilterPredicate {
  sql: string;
  paramTransform: (raw: string) => string;
}
export function mapFilterOperator(
  identifier: string,
  paramPlaceholder: string,
  dbType: string | null | undefined,
): FilterPredicate {
  const t = resolveIntrospectionDbType(dbType);
  switch (t) {
    case DB_TYPES.POSTGRES:
    case DB_TYPES.SNOWFLAKE:
      return {
        sql: `${identifier} ILIKE ${paramPlaceholder}`,
        paramTransform: v => `%${v}%`,
      };
    case DB_TYPES.ORACLE:
      return {
        sql: `UPPER(${identifier}) LIKE UPPER(${paramPlaceholder})`,
        paramTransform: v => `%${v}%`,
      };
    case DB_TYPES.MYSQL:
    case DB_TYPES.MARIADB:
    case DB_TYPES.MSSQL:
    default:
      return {
        sql: `${identifier} LIKE ${paramPlaceholder}`,
        paramTransform: v => `%${v}%`,
      };
  }
}

/**
 * Wrap the user query so a parse-and-no-rows pass tells the
 * driver everything we need about column metadata without
 * fetching any rows. Used as the validate step (catches parse
 * errors before we run the body) and the column-name discovery
 * step.
 */
export function wrapPreviewLimit0(
  query: string,
  dbType: string | null | undefined,
): string {
  const t = resolveIntrospectionDbType(dbType);
  // Strip a single trailing semicolon if present — the user often
  // ends with one and the wrapper would otherwise produce
  // `(SELECT …;) AS _sq` which is a syntax error in every dialect.
  const stripped = query.trim().replace(/;\s*$/, '');
  switch (t) {
    case DB_TYPES.MSSQL:
      return `SELECT TOP 0 * FROM (${stripped}) AS _sq`;
    case DB_TYPES.ORACLE:
      // Oracle's `LIMIT` was only added in 12c; ROWNUM works
      // everywhere from 9i+. Equivalent end result: zero rows,
      // full column metadata in the driver's `metaData` array.
      return `SELECT * FROM (${stripped}) WHERE ROWNUM = 0`;
    case DB_TYPES.POSTGRES:
    case DB_TYPES.MYSQL:
    case DB_TYPES.MARIADB:
    case DB_TYPES.SNOWFLAKE:
    default:
      return `SELECT * FROM (${stripped}) AS _sq LIMIT 0`;
  }
}

/**
 * Build the paginated SELECT around the user's query. Returns the
 * SQL string + the params array in dialect-appropriate order.
 *
 * `filterPredicates` is the list of pre-built fragments from
 * `mapFilterOperator` (one per filtered column); `filterParams`
 * carries the corresponding wildcard-wrapped values in the same
 * order. The pagination params (limit + offset) are appended at
 * the end of the array since they're the last placeholders we
 * emit. mssql + oracle 12c+ use OFFSET-then-FETCH so the param
 * order there is `offset, limit`; everyone else is `limit,
 * offset`. The function handles the swap for you.
 *
 * mssql + oracle require an `ORDER BY` for the OFFSET/FETCH
 * clause to be legal. We don't know the user's intended order,
 * so we inject `ORDER BY (SELECT NULL)` (mssql) or `ORDER BY
 * NULL` (oracle) — a no-op sort. Documented in the popup as
 * preview-only pagination with implementation-defined order.
 */
export interface PaginatedQuery {
  sql: string;
  params: unknown[];
}
export function wrapWithPagination(
  query: string,
  dbType: string | null | undefined,
  limit: number,
  offset: number,
  filterPredicates: string[],
  filterParams: unknown[],
): PaginatedQuery {
  const t = resolveIntrospectionDbType(dbType);
  const stripped = query.trim().replace(/;\s*$/, '');
  const whereClause = filterPredicates.length
    ? `WHERE ${filterPredicates.join(' AND ')}`
    : '';

  // Placeholders for limit + offset come AFTER the filter params,
  // so their 1-based index is (filterParams.length + 1) and so
  // on. Generate them via the `placeholder()` helper to keep the
  // dialect mapping in one place.
  const lphIndex = filterParams.length + 1;
  const ophIndex = filterParams.length + 2;
  const lph = placeholder(lphIndex, t);
  const oph = placeholder(ophIndex, t);

  switch (t) {
    case DB_TYPES.MSSQL:
      // OFFSET/FETCH requires ORDER BY. (SELECT NULL) is a
      // legal no-op sort in mssql; result order becomes
      // implementation-defined but the popup is preview-only.
      return {
        sql: `SELECT * FROM (${stripped}) AS _sq ${whereClause} ORDER BY (SELECT NULL) OFFSET ${oph} ROWS FETCH NEXT ${lph} ROWS ONLY`,
        params: [...filterParams, limit, offset],
      };
    case DB_TYPES.ORACLE:
      // Oracle 12c+ syntax. Pre-12c users are off the support
      // matrix for this product.
      return {
        sql: `SELECT * FROM (${stripped}) _sq ${whereClause} ORDER BY NULL OFFSET ${oph} ROWS FETCH NEXT ${lph} ROWS ONLY`,
        params: [...filterParams, limit, offset],
      };
    case DB_TYPES.POSTGRES:
    case DB_TYPES.MYSQL:
    case DB_TYPES.MARIADB:
    case DB_TYPES.SNOWFLAKE:
    default:
      return {
        sql: `SELECT * FROM (${stripped}) AS _sq ${whereClause} LIMIT ${lph} OFFSET ${oph}`,
        params: [...filterParams, limit, offset],
      };
  }
}

/**
 * Total-count companion to `wrapWithPagination`. Same filter
 * predicates / params, no LIMIT / OFFSET. Returns a single row
 * with one column (`total` or whatever the driver capitalises).
 */
export function buildCountQuery(
  query: string,
  dbType: string | null | undefined,
  filterPredicates: string[],
  filterParams: unknown[],
): PaginatedQuery {
  resolveIntrospectionDbType(dbType); // resolves + asserts known
  const stripped = query.trim().replace(/;\s*$/, '');
  const whereClause = filterPredicates.length
    ? `WHERE ${filterPredicates.join(' AND ')}`
    : '';
  return {
    sql: `SELECT COUNT(*) AS total FROM (${stripped}) AS _sq ${whereClause}`,
    params: [...filterParams],
  };
}
