/**
 * resolveLiveDatasetSql
 *
 * Walks dashboard → sourceAnalysisId → analyses → datasetId → dataset
 * and returns the dataset's CURRENT SQL and name. Replaces the old
 * snapshot-time pinning of `dashboard.datasetSql` / `datasetName` —
 * the product moved to a live model where edits to the source
 * dataset propagate to every dashboard without a republish.
 *
 * Throws if any link in the chain is broken (analysis deleted,
 * dataset deleted, mismatched org scope). Render-time callers should
 * surface this as a 404 / "source dataset no longer exists" message.
 *
 * Keeps the resolution in one place so future caching, RLS, or
 * permission checks against the dataset only need to be added here.
 */
import { EntityManager } from 'typeorm';
import { Analyses } from '../../db/entities/analyses.entity';
import { Dashboard } from '../../db/entities/dashboard.entity';
import { Dataset } from '../../db/entities/dataset.entity';

export interface LiveDatasetSql {
  /** Current dataset SQL — what every dashboard render will execute. */
  sql: string;
  /** Current dataset name — used in audit logs + UI breadcrumbs. */
  name: string;
  /** Resolved dataset id (matches dashboard.datasetId; returned for
   *  call-site convenience so consumers don't re-derive it). */
  datasetId: string;
}

export const resolveLiveDatasetSql = async (
  manager: EntityManager,
  dashboard: Dashboard,
): Promise<LiveDatasetSql> => {
  if (!dashboard.sourceAnalysisId) {
    // Dashboards built before sourceAnalysisId was introduced won't
    // have one. The publish flow has set this column for every
    // dashboard published since the snapshot model landed, so this
    // branch is a hard fail in practice.
    throw new Error(
      `Dashboard ${dashboard.id} has no sourceAnalysisId — cannot resolve live dataset SQL`,
    );
  }

  // Single-query resolution: join Analyses → Dataset and read the
  // dataset's live sql + name in one round-trip. Both entities have
  // `@DeleteDateColumn` so TypeORM's IS NULL filter on `deletedOn`
  // is applied automatically — soft-deleted analyses or datasets
  // are excluded and we surface a clean "source no longer available"
  // error to the renderer.
  const row = await manager
    .getRepository(Analyses)
    .createQueryBuilder('analyses')
    .innerJoin(Dataset, 'dataset', 'dataset.id = analyses."datasetId"')
    .select([
      'analyses.id AS "analysisId"',
      'analyses."datasetId" AS "datasetId"',
      'dataset.sql AS "sql"',
      'dataset.name AS "name"',
    ])
    .where('analyses.id = :analysisId', {
      analysisId: dashboard.sourceAnalysisId,
    })
    .andWhere('analyses."organisationId" = :orgId', {
      orgId: dashboard.organisationId,
    })
    .andWhere('dataset."organisationId" = :orgId', {
      orgId: dashboard.organisationId,
    })
    .andWhere('analyses."deletedOn" IS NULL')
    .andWhere('dataset."deletedOn" IS NULL')
    .getRawOne<{
      analysisId: string;
      datasetId: string;
      sql: string;
      name: string;
    }>();

  if (!row) {
    // We can't tell from one row whether it was the analysis or the
    // dataset that's missing, but the user-facing distinction doesn't
    // matter — either way the dashboard's source no longer exists.
    throw new Error(
      `Source for dashboard ${dashboard.id} is no longer available ` +
        `(analysis ${dashboard.sourceAnalysisId} or its dataset has been deleted or moved out of org scope)`,
    );
  }
  if (!row.sql || !row.sql.trim()) {
    throw new Error(
      `Dataset ${row.datasetId} has empty SQL — cannot render dashboard ${dashboard.id}`,
    );
  }

  return {
    sql: row.sql,
    name: row.name,
    datasetId: row.datasetId,
  };
};
