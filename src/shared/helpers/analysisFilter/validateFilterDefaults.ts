/**
 * validateFilterDefaults — dry-runs the value-presence query for any
 * filter that carries a `config.defaultValue` (or array of values)
 * and returns the subset of values that do NOT exist in the current
 * dataset.
 *
 * Used by add/update controllers to warn the user when they save a
 * filter whose default selection has gone stale. Best-effort:
 *   - Filters without a default are skipped.
 *   - Filters whose dataset / datasource is missing are reported as
 *     `error: 'dataset_missing'` so the FE can show a separate
 *     warning rather than silently dropping the result.
 *   - Network / SQL failures degrade to an empty stale list (the
 *     warning is advisory; we don't block the save on a probe error).
 *
 * Returns an array keyed by the filter's id (or transient index for
 * unsaved entries) so callers can match warnings to the filters they
 * just saved.
 */
import { DataSource } from 'typeorm';
import { AnalysisFilter } from '../../db/entities/analysis_filter.entity';
import { Dataset } from '../../db/entities/dataset.entity';
import { DatasourceS } from '../../db/entities/datasourceS.entity';
import { getErrorMessage } from '../../utility/getErrorMessage';
import Logger from '../../utility/logger/logger';
import {
  openDatasourceConnection,
  DatasourceQueryConnection,
} from '../datasource/openDatasourceConnection';

export interface StaleDefaultReport {
  /** The saved filter's id. Set by callers that pass real entities. */
  filterId: string;
  /** Values from the saved default that no longer exist. */
  values: (string | number)[];
  /** Set when the probe itself couldn't run. UI shows a softer warning. */
  error?: 'dataset_missing' | 'column_missing' | 'sql_error';
  message?: string;
}

/**
 * Extract the list of "default" values from a filter's config. Different
 * filter types stash defaults in different fields — normalise into a
 * single flat array.
 */
function extractDefaults(filter: AnalysisFilter): (string | number)[] {
  const cfg = filter.config || {};
  // Category filters: defaultValue may be a single string or an array
  // (multi-select). categoryValues is the allow-list, not the saved
  // selection — skip it.
  if (filter.filterType === 'category') {
    const dv = cfg.defaultValue;
    if (Array.isArray(dv)) return dv.filter(v => v !== null && v !== undefined);
    if (dv !== null && dv !== undefined && dv !== '') return [dv];
    return [];
  }
  // Numeric/time equality: a single value. Range filters have no
  // discrete "selected value" to validate — their min/max are bounds.
  if (
    filter.filterType === 'numeric_equality' ||
    filter.filterType === 'time_equality'
  ) {
    const v = cfg.defaultValue ?? cfg.numericValue;
    if (v === null || v === undefined || v === '') return [];
    return [v];
  }
  return [];
}

/**
 * Run the dry-run probe for one filter against an open connection.
 */
async function probeFilter(
  conn: DatasourceQueryConnection,
  filter: AnalysisFilter,
  datasetSql: string,
): Promise<StaleDefaultReport | null> {
  const defaults = extractDefaults(filter);
  if (defaults.length === 0) return null;

  const safeColumn = filter.columnName.replace(/[^a-zA-Z0-9_]/g, '');
  if (!safeColumn || safeColumn !== filter.columnName) {
    return {
      filterId: filter.id,
      values: [],
      error: 'sql_error',
      message: 'Invalid column name',
    };
  }

  const cleanedSql = datasetSql.trim().replace(/;+\s*$/, '');
  // Cast both sides to text so the IN-list works regardless of column
  // type (numeric, date, etc.). LOWER + TRIM make the comparison
  // case- and whitespace-insensitive — a saved 'Marketing ' (trailing
  // space) still matches a live 'Marketing'. That matches the user's
  // intent: they care whether the value EXISTS, not whether the
  // whitespace canonicalisation is bit-identical.
  const placeholders = defaults.map((_, i) => `$${i + 1}`).join(', ');
  const params = defaults.map(v => String(v).trim().toLowerCase());
  const probeSql = `
    SELECT DISTINCT LOWER(TRIM(__dataset."${safeColumn}"::text)) AS value
    FROM (${cleanedSql}) AS __dataset
    WHERE LOWER(TRIM(__dataset."${safeColumn}"::text)) IN (${placeholders})
  `;

  try {
    const rows: { value: string }[] = await conn.query(probeSql, params);
    const present = new Set(rows.map(r => r.value));
    const stale = defaults.filter(
      v => !present.has(String(v).trim().toLowerCase()),
    );
    if (stale.length === 0) return null;
    return { filterId: filter.id, values: stale };
  } catch (err) {
    const msg = getErrorMessage(err);
    const looksMissing =
      msg.includes('does not exist') ||
      msg.toLowerCase().includes('undefined_column');
    Logger.warn(
      `Validate-defaults probe failed for filter ${filter.id}: ${msg}`,
    );
    return {
      filterId: filter.id,
      values: [],
      error: looksMissing ? 'column_missing' : 'sql_error',
      message: msg,
    };
  }
}

/**
 * Run the dry-run probe for a list of saved filters. Returns only the
 * filters that have stale defaults; healthy filters are omitted from
 * the array so the FE can simply check `length`.
 */
export async function validateFilterDefaults(
  masterDbConnection: DataSource,
  filters: AnalysisFilter[],
  clientData: any,
): Promise<StaleDefaultReport[]> {
  if (!filters.length) return [];

  const reports: StaleDefaultReport[] = [];

  // Group by datasourceId to share one external connection per source.
  const byDatasource = new Map<string, AnalysisFilter[]>();
  for (const f of filters) {
    if (!extractDefaults(f).length) continue;
    const list = byDatasource.get(f.datasourceId) || [];
    list.push(f);
    byDatasource.set(f.datasourceId, list);
  }
  if (byDatasource.size === 0) return [];

  for (const [dsId, group] of byDatasource.entries()) {
    const datasetIds = Array.from(new Set(group.map(f => f.datasetId)));
    const datasets: Dataset[] = await masterDbConnection
      .getRepository(Dataset)
      .createQueryBuilder('d')
      .where('d.id IN (:...ids)', { ids: datasetIds })
      .getMany();
    const datasetsById = new Map(datasets.map(d => [d.id, d]));

    const database: DatasourceS | null = await masterDbConnection
      .getRepository(DatasourceS)
      .createQueryBuilder('ds')
      .leftJoinAndSelect('ds.config', 'config')
      .where('ds.id = :id', { id: dsId })
      .getOne();

    if (!database) {
      for (const f of group) {
        reports.push({
          filterId: f.id,
          values: [],
          error: 'dataset_missing',
          message: 'Datasource not found',
        });
      }
      continue;
    }

    let conn: DatasourceQueryConnection | null = null;
    try {
      conn = await openDatasourceConnection(database.config, clientData.config);
      if (!conn) {
        for (const f of group) {
          reports.push({
            filterId: f.id,
            values: [],
            error: 'sql_error',
            message: 'Could not connect to datasource',
          });
        }
        continue;
      }

      for (const f of group) {
        const dataset = datasetsById.get(f.datasetId);
        if (!dataset) {
          reports.push({
            filterId: f.id,
            values: [],
            error: 'dataset_missing',
            message: 'Dataset not found',
          });
          continue;
        }
        const report = await probeFilter(conn, f, dataset.sql);
        if (report) reports.push(report);
      }
    } finally {
      if (conn) await conn.destroy();
    }
  }

  return reports;
}
