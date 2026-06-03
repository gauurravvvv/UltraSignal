/**
 * fetchFilterValues — runs the DISTINCT-values query for one analysis
 * filter and returns a structured per-filter result. Shared between
 * the legacy GET /analysis-filter/values/:filterId endpoint and the
 * new batched POST /analysis-filter/values endpoint.
 *
 * Returned shape mirrors the design doc:
 *   { ok: true,  values, total, truncated, nextPage? }
 *   { ok: false, error: 'column_missing' | 'sql_error', message }
 *
 * Why a separate helper? Two endpoints need the same logic; replicating
 * it would let the legacy and batched paths drift. The helper does
 * NOT open a DB connection — the caller owns the connection lifecycle
 * so batch callers can reuse a single connection across many filters.
 */
import { createHash } from 'crypto';
import { AnalysisFilter } from '../../db/entities/analysis_filter.entity';
import { DatasourceQueryConnection } from '../datasource/openDatasourceConnection';
import { getErrorMessage } from '../../utility/getErrorMessage';
import Logger from '../../utility/logger/logger';

/** Max page size we'll ever honour, regardless of caller input. */
const MAX_PAGE_SIZE = 500;
/** Default page size when caller doesn't specify. */
const DEFAULT_PAGE_SIZE = 100;
/** Soft cap on the COUNT subquery — distinct-count on a huge column
 *  is expensive, so we only count up to this and report "approximate"
 *  beyond it. */
const COUNT_CAP = 10_000;

export interface FilterValuesRequest {
  filterId: string;
  search?: string;
  page?: number;
  pageSize?: number;
  // Reserved for cascading filters (v2.1). Ignored in v2.
  parentSelections?: Record<string, (string | number)[]>;
}

export interface FilterValueOption {
  value: string | number | null;
  label: string;
}

export type FilterValuesResult =
  | {
      ok: true;
      values: FilterValueOption[];
      total: number;
      // True when `total` hit the COUNT_CAP — caller should display
      // "~X+ values" rather than an exact number.
      totalApproximate: boolean;
      // True when there are more pages beyond this one.
      truncated: boolean;
      nextPage: number | null;
    }
  | {
      ok: false;
      error: 'column_missing' | 'sql_error' | 'forbidden';
      message: string;
    };

/**
 * Process-local cache of dataset projected-column lists. Keyed by a
 * stable hash of `${datasetId}|${sqlHash}` so a dataset's SQL change
 * naturally invalidates its entry (next caller computes a new key).
 *
 * 5-minute TTL bounds staleness when the cache is keyed without the
 * SQL changing — e.g. the dataset SQL stays the same but the
 * underlying source's column list changed via DDL. Probe cost is
 * ~one DB round trip, so 5 min is a comfortable trade between hit
 * rate and freshness.
 */
const PROBE_TTL_MS = 5 * 60 * 1000;
interface ProbeEntry {
  columns: string[] | null;
  ts: number;
}
const probeCache = new Map<string, ProbeEntry>();

/** Stable cache key from datasetId + sqlHash so SQL edits invalidate. */
function probeCacheKey(datasetId: string, sql: string): string {
  const sqlHash = createHash('sha256')
    .update(sql || '')
    .digest('hex')
    .slice(0, 16);
  return `${datasetId}|${sqlHash}`;
}

/**
 * Read the projected column names from a dataset SQL. Uses a small
 * in-process cache (`probeCache`) so repeated batch calls within a
 * 5-minute window don't re-probe the source DB.
 *
 * Returns null when the probe itself fails (dataset SQL invalid,
 * connection trouble, etc.) — caller falls back to letting the
 * actual value query surface the error.
 */
export async function getDatasetColumns(
  conn: DatasourceQueryConnection,
  datasetSql: string,
  datasetId?: string,
): Promise<string[] | null> {
  const cleaned = datasetSql.trim().replace(/;+\s*$/, '');

  // Cache lookup — only when the caller can identify the dataset.
  // Without a datasetId we can't safely invalidate on edits, so we
  // skip caching and probe live every time.
  const key = datasetId ? probeCacheKey(datasetId, cleaned) : null;
  if (key) {
    const cached = probeCache.get(key);
    if (cached && Date.now() - cached.ts < PROBE_TTL_MS) {
      return cached.columns;
    }
  }

  // LIMIT 0 returns no rows but still validates column projection and
  // lets pg send us the field descriptor list.
  const probe = `SELECT * FROM (${cleaned}) AS __probe LIMIT 0`;
  try {
    // Get a raw pg client from the pool so we can read `result.fields`.
    // TypeORM's high-level query() drops this metadata.
    const driver: any = (conn as any).driver;
    if (!driver?.master) return null;
    const pool = driver.master;
    const client = await pool.connect();
    try {
      const result = await client.query(probe);
      const fields = result?.fields;
      const columns = Array.isArray(fields)
        ? fields.map((f: any) => f.name)
        : null;
      if (key) probeCache.set(key, { columns, ts: Date.now() });
      return columns;
    } finally {
      client.release();
    }
  } catch (err) {
    Logger.warn(
      `Dataset column probe failed: ${getErrorMessage(err)} — falling back to no-precheck`,
    );
    // Cache the failure too — repeating a guaranteed-to-fail probe
    // every batch call is wasteful. TTL ensures we retry within 5 min.
    if (key) probeCache.set(key, { columns: null, ts: Date.now() });
    return null;
  }
}

/**
 * Manual cache eviction for testing / forced refresh paths. Not
 * currently wired to a route — call from a future "refresh dataset"
 * action if/when that surface lands.
 */
export function clearDatasetColumnsCache(datasetId?: string): void {
  if (!datasetId) {
    probeCache.clear();
    return;
  }
  for (const k of Array.from(probeCache.keys())) {
    if (k.startsWith(`${datasetId}|`)) probeCache.delete(k);
  }
}

/**
 * Execute the value-fetch query for a single filter. Caller provides
 * an open DataSource pointing at the client's external source DB.
 */
export async function fetchFilterValues(
  conn: DatasourceQueryConnection,
  filter: AnalysisFilter,
  datasetSql: string,
  request: FilterValuesRequest,
  // Pre-validated column list (from getDatasetColumns). Pass null to
  // skip the precheck — the query will fail with sql_error if the
  // column is missing.
  projectedColumns: string[] | null,
): Promise<FilterValuesResult> {
  // Strict allow-list on the column name. The dataset SQL is wrapped
  // in a subquery so this is the only point user-supplied identifier
  // text touches the outer query — keep it tight.
  const safeColumn = filter.columnName.replace(/[^a-zA-Z0-9_]/g, '');
  if (!safeColumn || safeColumn !== filter.columnName) {
    return {
      ok: false,
      error: 'sql_error',
      message: `Invalid column name: ${filter.columnName}`,
    };
  }

  // Bucket E (dropped-column precheck). Only enforced when we got a
  // column list back from the probe — graceful degradation when the
  // driver doesn't expose metadata.
  if (
    projectedColumns &&
    !projectedColumns.includes(safeColumn) &&
    // Some drivers normalise case; check both as a courtesy.
    !projectedColumns.some(c => c.toLowerCase() === safeColumn.toLowerCase())
  ) {
    return {
      ok: false,
      error: 'column_missing',
      message: `Column "${safeColumn}" is not in the dataset output anymore.`,
    };
  }

  const pageSize = Math.min(
    Math.max(request.pageSize ?? DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE,
  );
  const page = Math.max(request.page ?? 1, 1);
  const offset = (page - 1) * pageSize;
  const search = (request.search ?? '').trim();

  const cleanedSql = datasetSql.trim().replace(/;+\s*$/, '');

  // Build the WHERE clause. nullOption semantics on the filter row
  // dictate whether NULL values appear in the picker.
  const whereParts: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  switch (filter.nullOption) {
    case 'NULLS_ONLY':
      whereParts.push(`__dataset."${safeColumn}" IS NULL`);
      break;
    case 'NON_NULLS_ONLY':
    case undefined:
    case null:
      whereParts.push(`__dataset."${safeColumn}" IS NOT NULL`);
      break;
    case 'ALL_VALUES':
      // No null filter — both null and non-null included.
      break;
  }

  if (search) {
    whereParts.push(`__dataset."${safeColumn}"::text ILIKE $${paramIdx}`);
    params.push(`%${search}%`);
    paramIdx += 1;
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const valuesSql =
    `SELECT DISTINCT __dataset."${safeColumn}" AS value ` +
    `FROM (${cleanedSql}) AS __dataset ` +
    `${whereSql} ` +
    `ORDER BY value ` +
    `LIMIT ${pageSize + 1} OFFSET ${offset}`;

  // Count query — capped at COUNT_CAP so distinct-count on huge
  // columns doesn't dominate request time. The +1 trick on the value
  // query tells us if there are more pages without paying for COUNT
  // every time.
  const countSql =
    `SELECT COUNT(*) AS total FROM (` +
    `  SELECT DISTINCT __dataset."${safeColumn}" ` +
    `  FROM (${cleanedSql}) AS __dataset ` +
    `  ${whereSql} ` +
    `  LIMIT ${COUNT_CAP + 1}` +
    `) AS __capped`;

  try {
    // Run value + count in parallel. Count is only fetched on page 1
    // — for subsequent pages we already have the total client-side.
    const [valueRows, countRows] = await Promise.all([
      conn.query(valuesSql, params),
      page === 1 ? conn.query(countSql, params) : Promise.resolve(null),
    ]);

    const rows: { value: string | number | null }[] = valueRows;
    const hasMore = rows.length > pageSize;
    const trimmed = hasMore ? rows.slice(0, pageSize) : rows;

    const values: FilterValueOption[] = trimmed.map(r => ({
      value: r.value,
      label: r.value === null ? '(empty)' : String(r.value),
    }));

    let total = 0;
    let totalApproximate = false;
    if (countRows && countRows[0]) {
      const rawTotal = Number(countRows[0].total);
      if (rawTotal > COUNT_CAP) {
        total = COUNT_CAP;
        totalApproximate = true;
      } else {
        total = rawTotal;
      }
    } else {
      // Subsequent pages — estimate total from current offset.
      total = offset + trimmed.length + (hasMore ? 1 : 0);
      totalApproximate = hasMore;
    }

    return {
      ok: true,
      values,
      total,
      totalApproximate,
      truncated: hasMore,
      nextPage: hasMore ? page + 1 : null,
    };
  } catch (err) {
    const msg = getErrorMessage(err);
    Logger.warn(
      `Filter values query failed for filter ${filter.id} (column ${safeColumn}): ${msg}`,
    );
    // Postgres "column does not exist" surfaces here when the precheck
    // didn't run (e.g. probe returned null). Detect the canonical error
    // code so the FE still gets a useful classification.
    const looksLikeMissingColumn =
      msg.includes('does not exist') ||
      msg.toLowerCase().includes('undefined_column');
    return {
      ok: false,
      error: looksLikeMissingColumn ? 'column_missing' : 'sql_error',
      message: msg,
    };
  }
}
