/**
 * snapshotAnalysisIntoDashboard
 *
 * Captures the publish-time state of an analysis into a dashboard's
 * snapshot tables. The dashboard becomes fully self-contained at the
 * moment this helper completes — it never reads from Analyses,
 * Visual, VisualConfig, DatasetField, AnalysisFilter, or Dataset
 * again. Render endpoints query the snapshot tables exclusively.
 *
 * What it copies:
 *   - dataset.sql + dataset.name onto the Dashboard row itself
 *     (single values, denormalised so we never join Dataset live)
 *   - Visual + VisualConfig pairs → DashboardVisual + DashboardVisualConfig
 *   - DatasetField rows (dataset-level + analysis-level for this
 *     analysis) → DashboardField
 *   - DatasetFieldRelation graph → DashboardFieldRelation with
 *     remapped IDs pointing at the new DashboardField rows
 *   - AnalysisFilter rows → DashboardFilter
 *
 * Idempotent via wipe-then-write: any pre-existing snapshot rows for
 * this dashboard are deleted first, then the fresh snapshot is
 * inserted. This means the helper handles both publish-as-new (which
 * just won't find anything to wipe) and publish-as-existing (which
 * wipes the previous snapshot before writing the new one).
 *
 * Runs inside the caller's transaction — caller passes the
 * EntityManager from `manager.transaction(...)` so all writes commit
 * atomically with the Dashboard row itself.
 */
import { EntityManager, IsNull } from 'typeorm';
import { Analyses } from '../../db/entities/analyses.entity';
import { AnalysisFilter } from '../../db/entities/analysis_filter.entity';
import { Dashboard } from '../../db/entities/dashboard.entity';
import { DashboardField } from '../../db/entities/dashboardField.entity';
import { DashboardFieldRelation } from '../../db/entities/dashboardFieldRelation.entity';
import { DashboardFilter } from '../../db/entities/dashboardFilter.entity';
import { DashboardVisual } from '../../db/entities/dashboardVisual.entity';
import { DashboardVisualConfig } from '../../db/entities/dashboardVisualConfig.entity';
import { Dataset } from '../../db/entities/dataset.entity';
import { DatasetField } from '../../db/entities/datasetField.entity';
import { DatasetFieldRelation } from '../../db/entities/datasetFieldRelation.entity';
import Logger from '../../utility/logger/logger';

export interface SnapshotResult {
  /** Number of visuals captured. */
  visualCount: number;
  /** Number of filters captured. */
  filterCount: number;
  /** Number of fields captured (dataset + analysis level combined). */
  fieldCount: number;
  /** Number of field-dependency relations captured. */
  relationCount: number;
}

/**
 * Wipe any existing snapshot children for this dashboard. Used by
 * publish-as-existing and by publish-as-new (which is a no-op since
 * a fresh dashboard has no children yet — idempotent).
 *
 * Order matters: VisualConfig has FK to Visual; FieldRelation has FK
 * to Field. Children first, parents last.
 */
async function wipeExistingSnapshot(
  manager: EntityManager,
  dashboardId: string,
): Promise<void> {
  // VisualConfig FKs to DashboardVisual via dashboardVisualId
  await manager.getRepository(DashboardVisualConfig).delete({ dashboardId });
  await manager.getRepository(DashboardVisual).delete({ dashboardId });

  // FieldRelation FKs to DashboardField
  await manager.getRepository(DashboardFieldRelation).delete({ dashboardId });
  await manager.getRepository(DashboardField).delete({ dashboardId });

  await manager.getRepository(DashboardFilter).delete({ dashboardId });
}

export const snapshotAnalysisIntoDashboard = async (
  manager: EntityManager,
  analysisId: string,
  dashboard: Dashboard,
): Promise<SnapshotResult> => {
  Logger.info(`Snapshot analysis ${analysisId} into dashboard ${dashboard.id}`);

  // ── Load source state (analysis + visuals + visualConfigs) ───────
  const analysis = await manager.getRepository(Analyses).findOne({
    where: { id: analysisId, clientId: dashboard.clientId },
    relations: ['visuals', 'visuals.visualConfig'],
  });
  if (!analysis) {
    throw new Error(`Analysis ${analysisId} not found`);
  }

  // Dataset is loaded separately so we get the .sql column without
  // pulling unrelated relations into memory.
  const dataset = await manager.getRepository(Dataset).findOne({
    where: { id: analysis.datasetId, clientId: dashboard.clientId },
  });
  if (!dataset) {
    throw new Error(`Dataset ${analysis.datasetId} not found`);
  }

  // Dataset-level + analysis-level fields. We snapshot BOTH:
  //  - dataset-level (analysisId IS NULL) so the dashboard knows
  //    what native columns existed at publish time, surviving later
  //    dataset SQL edits
  //  - analysis-level (analysisId = this analysis) so the dashboard
  //    can compute analysis-scoped custom-field formulas
  const sourceFields = await manager.getRepository(DatasetField).find({
    where: [
      { datasetId: dataset.id, analysisId: IsNull() },
      { datasetId: dataset.id, analysisId },
    ],
    order: { sequence: 'ASC' },
  });

  // Dependency graph among those fields. We filter to only relations
  // where both ends are in our sourceFields set — otherwise a custom
  // field that referenced a no-longer-snapshotted field would leave
  // an orphan relation.
  const sourceFieldIds = new Set(sourceFields.map(f => f.id));
  // Postgres rejects `IN ()`. Skip the query entirely when there are
  // no source fields — relevantRelations stays empty and the rest of
  // the helper works (a dashboard with zero fields is valid).
  const allRelations = sourceFieldIds.size
    ? await manager
        .getRepository(DatasetFieldRelation)
        .createQueryBuilder('rel')
        .where('rel.fieldId IN (:...ids)', {
          ids: Array.from(sourceFieldIds),
        })
        .getMany()
    : [];
  const relevantRelations = allRelations.filter(
    r =>
      sourceFieldIds.has(r.fieldId) && sourceFieldIds.has(r.referencedFieldId),
  );

  // Analysis filters.
  const sourceFilters = await manager.getRepository(AnalysisFilter).find({
    where: { analysisId, clientId: dashboard.clientId },
    order: { sequence: 'ASC' },
  });

  // ── Wipe any existing snapshot for this dashboard ────────────────
  await wipeExistingSnapshot(manager, dashboard.id);

  // Sanity: the controller is responsible for stamping datasetId on
  // the Dashboard row before calling this helper. datasetId stays
  // pinned (it's how the renderer scopes RLS / field lookups) even
  // though datasetSql / datasetName have moved to a live model.
  if (dashboard.datasetId !== dataset.id) {
    throw new Error(
      `snapshotAnalysisIntoDashboard: dashboard.datasetId (${dashboard.datasetId}) ` +
        `does not match the source analysis's dataset (${dataset.id}). ` +
        'The publishDashboard controller is responsible for stamping this — ' +
        'check it has not regressed.',
    );
  }

  // ── Write fields (and build the id remap) ────────────────────────
  // Each source field gets a fresh DashboardField row with a new uuid.
  // We keep a map sourceFieldId → newDashboardField so the relation
  // table can be remapped correctly below.
  const fieldRepo = manager.getRepository(DashboardField);
  const idMap = new Map<string, string>(); // sourceFieldId → newId
  const newFields: DashboardField[] = sourceFields.map(src => {
    const f = new DashboardField();
    f.dashboardId = dashboard.id;
    f.columnToUse = src.columnToUse;
    f.columnToView = src.columnToView;
    f.customLogic = src.customLogic;
    f.isCfUsed = src.isCfUsed;
    f.type = src.type;
    f.dataType = src.dataType;
    f.sequence = src.sequence;
    f.clientId = src.clientId;
    f.clientName = src.clientName;
    f.datasourceId = src.datasourceId;
    f.datasetId = src.datasetId;
    f.sourceFieldId = src.id;
    f.sourceScope = src.analysisId ? 'analysis' : 'dataset';
    return f;
  });
  const savedFields = await fieldRepo.save(newFields);
  // Key the remap by sourceFieldId rather than relying on save()
  // preserving positional order — TypeORM doesn't contractually
  // guarantee that across versions.
  savedFields.forEach(newF => {
    if (newF.sourceFieldId) idMap.set(newF.sourceFieldId, newF.id);
  });

  // ── Write field relations with remapped ids ──────────────────────
  const newRelations: DashboardFieldRelation[] = relevantRelations
    .map(src => {
      const newFieldId = idMap.get(src.fieldId);
      const newRefId = idMap.get(src.referencedFieldId);
      if (!newFieldId || !newRefId) return null; // shouldn't happen — filtered above
      const r = new DashboardFieldRelation();
      r.dashboardId = dashboard.id;
      r.fieldId = newFieldId;
      r.referencedFieldId = newRefId;
      return r;
    })
    .filter((r): r is DashboardFieldRelation => r !== null);
  if (newRelations.length > 0) {
    await manager.getRepository(DashboardFieldRelation).save(newRelations);
  }

  // ── Write visuals + visual configs ───────────────────────────────
  // Save all visuals in one INSERT, then look up each saved visual by
  // sourceVisualId to attach its config. Avoids the previous 2N round
  // trips (one per visual + one per config). A dashboard with 12
  // visuals: 2 INSERTs instead of 24.
  const visualRepo = manager.getRepository(DashboardVisual);
  const configRepo = manager.getRepository(DashboardVisualConfig);

  const sortedVisuals = (analysis.visuals || []).slice();
  // Visual.entity has no `sequence` column — preserve insertion order.

  const newVisuals: DashboardVisual[] = sortedVisuals.map((src, i) => {
    const v = new DashboardVisual();
    v.dashboardId = dashboard.id;
    v.title = src.title;
    v.widthRatio = src.widthRatio;
    v.heightRatio = src.heightRatio;
    v.xRatio = src.xRatio;
    v.yRatio = src.yRatio;
    v.sequence = i;
    v.clientId = src.clientId;
    v.clientName = src.clientName;
    v.datasourceId = src.datasourceId;
    v.datasetId = src.datasetId;
    v.sourceVisualId = src.id;
    return v;
  });

  const savedVisuals = newVisuals.length
    ? await visualRepo.save(newVisuals)
    : [];

  // sourceVisualId → newId remap, same approach as the field idMap
  // so we don't depend on save() preserving array order.
  const visualIdMap = new Map<string, string>();
  savedVisuals.forEach(sv => {
    if (sv.sourceVisualId) visualIdMap.set(sv.sourceVisualId, sv.id);
  });

  const newConfigs: DashboardVisualConfig[] = sortedVisuals
    .filter(src => src.visualConfig)
    .map(src => {
      const srcCfg = src.visualConfig!;
      const newVisualId = visualIdMap.get(src.id)!;
      const c = new DashboardVisualConfig();
      c.dashboardId = dashboard.id;
      c.dashboardVisualId = newVisualId;
      c.chartType = srcCfg.chartType;
      c.xAxisColumn = srcCfg.xAxisColumn;
      c.yAxisColumn = srcCfg.yAxisColumn;
      c.config = srcCfg.config;
      c.clientId = srcCfg.clientId;
      c.clientName = srcCfg.clientName;
      c.datasourceId = srcCfg.datasourceId;
      c.datasetId = srcCfg.datasetId;
      return c;
    });

  if (newConfigs.length > 0) {
    await configRepo.save(newConfigs);
  }

  // ── Write filters ────────────────────────────────────────────────
  const filterRepo = manager.getRepository(DashboardFilter);
  const newFilters: DashboardFilter[] = sourceFilters.map(src => {
    const f = new DashboardFilter();
    f.dashboardId = dashboard.id;
    f.name = src.name;
    f.filterType = src.filterType;
    f.columnName = src.columnName;
    f.controlType = src.controlType;
    f.config = src.config;
    f.nullOption = src.nullOption;
    f.isEnabled = src.isEnabled;
    f.isMandatory = src.isMandatory;
    f.sequence = src.sequence;
    f.clientId = src.clientId;
    f.clientName = src.clientName;
    f.datasourceId = src.datasourceId;
    f.datasetId = src.datasetId;
    f.sourceFilterId = src.id;
    return f;
  });
  if (newFilters.length > 0) {
    await filterRepo.save(newFilters);
  }

  return {
    visualCount: sortedVisuals.length,
    filterCount: sourceFilters.length,
    fieldCount: sourceFields.length,
    relationCount: newRelations.length,
  };
};
