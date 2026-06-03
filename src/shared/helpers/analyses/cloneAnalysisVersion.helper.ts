/**
 * cloneAnalysisVersion
 *
 * Spawns a new version of an existing analysis lineage as part of the
 * versioned-edit model. The previous version is left immutable so any
 * dashboards that pinned to it (via Dashboard.sourceAnalysisId) keep
 * rendering exactly the same way they did at publish time.
 *
 * What gets deep-copied (every row gets a fresh uuid; foreign keys are
 * remapped to the new analysis / new field / new visual id):
 *
 *   • Analyses                        — one new row, versionNumber + 1
 *   • Visual                          — every visual the source had
 *   • VisualConfig                    — paired with its new Visual
 *   • AnalysisFilter                  — every filter the source had
 *   • DatasetField (analysisId = src) — analysis-scoped custom fields
 *   • DatasetFieldRelation            — only edges with BOTH endpoints
 *                                       in the cloned field set;
 *                                       remapped through an id map
 *
 * What does NOT get copied:
 *
 *   • Dataset row / dataset-level DatasetField — they remain shared
 *     across every version of every analysis (live model). Editing a
 *     dataset propagates to all versions immediately.
 *   • Dashboard rows — dashboards point at a specific Analyses.id and
 *     stay pinned to whichever version they were published from.
 *
 * Runs inside a caller-supplied transaction so the new version
 * appears atomically or not at all. If any insert throws, every
 * row created in this helper rolls back.
 *
 * Returns the new Analyses row plus an idMap so callers (e.g. the
 * updateAnalysis controller) can apply user edits to the cloned
 * children by their NEW ids.
 */
import { EntityManager } from 'typeorm';
import { Analyses } from '../../db/entities/analyses.entity';
import { AnalysisFilter } from '../../db/entities/analysis_filter.entity';
import { DatasetField } from '../../db/entities/datasetField.entity';
import { DatasetFieldRelation } from '../../db/entities/datasetFieldRelation.entity';
import { Visual } from '../../db/entities/visual.entity';
import { VisualConfig } from '../../db/entities/visual_config.entity';
import Logger from '../../utility/logger/logger';

/**
 * Maps from source-row id to clone-row id, one map per child entity.
 * Returned alongside the new analysis so callers can find which new
 * row corresponds to which old one — e.g. to apply edits sent by
 * the FE using the OLD ids.
 */
export interface CloneIdMap {
  visualIds: Map<string, string>;
  visualConfigIds: Map<string, string>;
  filterIds: Map<string, string>;
  datasetFieldIds: Map<string, string>;
}

export interface ClonedAnalysisVersion {
  analysis: Analyses;
  idMap: CloneIdMap;
}

export const cloneAnalysisVersion = async (
  manager: EntityManager,
  sourceAnalysisId: string,
  clientId: string,
  loggedInId: string,
): Promise<ClonedAnalysisVersion> => {
  // ── 1. Load the source analysis ──────────────────────────────────
  const source = await manager.getRepository(Analyses).findOne({
    where: { id: sourceAnalysisId, clientId },
  });
  if (!source) {
    throw new Error(
      `cloneAnalysisVersion: source analysis ${sourceAnalysisId} not found`,
    );
  }

  // The first row in a lineage has its own id as the lineageId.
  // Subsequent rows copy that lineageId so the whole chain is
  // discoverable with one indexed lookup.
  const lineageId = source.lineageId ?? source.id;

  // ── 2. Insert the new Analyses row, with race-safe versionNumber ─
  //
  // versionNumber is `MAX(versionNumber) + 1` across the lineage.
  // Concurrency: two parallel edits on the same lineage both observe
  // the same MAX and would both insert N+1. The Analyses entity has
  // a unique index on (lineageId, versionNumber) which causes the
  // second insert to raise a Postgres unique-violation (errcode
  // 23505). We retry up to MAX_VERSION_RETRIES with a fresh MAX
  // read so the racing caller eventually picks N+2.
  const MAX_VERSION_RETRIES = 5;
  let newAnalysis!: Analyses;
  let attempt = 0;
  while (attempt < MAX_VERSION_RETRIES) {
    const maxRow = await manager
      .getRepository(Analyses)
      .createQueryBuilder('a')
      .select('MAX(a.versionNumber)', 'max')
      .where('a.lineageId = :lineageId', { lineageId })
      .getRawOne<{ max: number | null }>();
    const nextVersion = (maxRow?.max ?? source.versionNumber ?? 1) + 1;

    const clone = manager.getRepository(Analyses).create({
      name: source.name,
      description: source.description,
      datasetId: source.datasetId,
      clientId: source.clientId,
      clientName: source.clientName,
      datasourceId: source.datasourceId,
      status: source.status,
      lineageId,
      versionNumber: nextVersion,
      createdBy: loggedInId,
      updatedBy: loggedInId,
    });
    try {
      newAnalysis = await manager.getRepository(Analyses).save(clone);
      break;
    } catch (err: any) {
      const isUniqueViolation =
        err?.code === '23505' ||
        /duplicate key value violates unique constraint/i.test(
          err?.message ?? '',
        );
      if (!isUniqueViolation) throw err;
      attempt++;
      Logger.warn(
        `cloneAnalysisVersion: versionNumber race on lineage ${lineageId}, ` +
          `retry ${attempt}/${MAX_VERSION_RETRIES}`,
      );
      if (attempt >= MAX_VERSION_RETRIES) {
        throw new Error(
          `cloneAnalysisVersion: exhausted ${MAX_VERSION_RETRIES} retries ` +
            `on lineage ${lineageId}. Concurrent edits are unusually heavy ` +
            'for this lineage — investigate.',
        );
      }
    }
  }

  // Defensive: if the source row was the very first version and
  // lineageId was null, backfill it now. Subsequent saves on the
  // source row won't happen (analyses are immutable after edit), but
  // having lineageId set on every row in the lineage simplifies the
  // listing query.
  if (!source.lineageId) {
    source.lineageId = source.id;
    await manager.getRepository(Analyses).save(source);
  }

  Logger.info(
    `cloneAnalysisVersion: lineage ${lineageId} → v${newAnalysis.versionNumber} ` +
      `(${source.id} → ${newAnalysis.id})`,
  );

  // ── 3. Clone analysis-scoped DatasetField rows ───────────────────
  // Dataset-level fields (analysisId IS NULL) are NOT cloned — they
  // remain shared across every version of every analysis.
  const sourceFields = await manager
    .getRepository(DatasetField)
    .find({ where: { analysisId: source.id } });
  const fieldIdMap = new Map<string, string>();
  const fieldClones: DatasetField[] = sourceFields.map(src => {
    const f = manager.getRepository(DatasetField).create({
      columnToUse: src.columnToUse,
      columnToView: src.columnToView,
      customLogic: src.customLogic,
      isCfUsed: src.isCfUsed,
      type: src.type,
      dataType: src.dataType,
      sequence: src.sequence,
      clientId: src.clientId,
      clientName: src.clientName,
      datasourceId: src.datasourceId,
      datasetId: src.datasetId,
      analysisId: newAnalysis.id,
    });
    return f;
  });
  const savedFields = fieldClones.length
    ? await manager.getRepository(DatasetField).save(fieldClones)
    : [];
  sourceFields.forEach((src, i) => fieldIdMap.set(src.id, savedFields[i].id));

  // ── 4. Clone DatasetFieldRelation rows (remapped) ────────────────
  // Only edges where BOTH endpoints are in our cloned field set get
  // copied — relations that cross into dataset-scoped fields (or any
  // other unrelated fields) are skipped because their endpoints
  // aren't in fieldIdMap and would dangle if we kept the old ids.
  if (sourceFields.length > 0) {
    const sourceFieldIds = sourceFields.map(f => f.id);
    const allEdges = await manager
      .getRepository(DatasetFieldRelation)
      .createQueryBuilder('rel')
      .where('rel.fieldId IN (:...ids) OR rel.referencedFieldId IN (:...ids)', {
        ids: sourceFieldIds,
      })
      .getMany();
    const remappable = allEdges.filter(
      e => fieldIdMap.has(e.fieldId) && fieldIdMap.has(e.referencedFieldId),
    );
    const edgeClones = remappable.map(e =>
      manager.getRepository(DatasetFieldRelation).create({
        fieldId: fieldIdMap.get(e.fieldId)!,
        referencedFieldId: fieldIdMap.get(e.referencedFieldId)!,
      }),
    );
    if (edgeClones.length) {
      await manager.getRepository(DatasetFieldRelation).save(edgeClones);
    }
  }

  // ── 5. Clone Visual + VisualConfig pairs ─────────────────────────
  // VisualConfig holds a FK to Visual (visualId), so we have to
  // create the Visual first, then create its config with the new
  // visualId. The two-pass design keeps the cloning O(n) and lets
  // us return both id maps for callers that re-key edits.
  const sourceVisuals = await manager.getRepository(Visual).find({
    where: { analysisId: source.id },
    relations: ['visualConfig'],
  });
  const visualIdMap = new Map<string, string>();
  const visualConfigIdMap = new Map<string, string>();
  if (sourceVisuals.length > 0) {
    // Bulk-insert all Visual rows in one round-trip. TypeORM's save()
    // accepts an array and emits a single multi-row INSERT for entities
    // whose primary key is generated server-side; the returned array
    // preserves input order so we can correlate by index.
    const visualClones = sourceVisuals.map(sv =>
      manager.getRepository(Visual).create({
        title: sv.title,
        widthRatio: sv.widthRatio,
        heightRatio: sv.heightRatio,
        xRatio: sv.xRatio,
        yRatio: sv.yRatio,
        clientId: sv.clientId,
        clientName: sv.clientName,
        datasourceId: sv.datasourceId,
        datasetId: sv.datasetId,
        analysisId: newAnalysis.id,
        sequence: sv.sequence ?? 0,
      }),
    );
    const savedVisuals = await manager.getRepository(Visual).save(visualClones);
    sourceVisuals.forEach((sv, i) =>
      visualIdMap.set(sv.id, savedVisuals[i].id),
    );

    // Now bulk-insert all VisualConfig rows in one go too, mapping
    // each new visual to its cloned config.
    const configClones: VisualConfig[] = [];
    const configSources: { src: VisualConfig; cloneIdx: number }[] = [];
    sourceVisuals.forEach((sv, i) => {
      if (!sv.visualConfig) return;
      const sc = sv.visualConfig;
      configClones.push(
        manager.getRepository(VisualConfig).create({
          chartType: sc.chartType,
          xAxisColumn: sc.xAxisColumn,
          yAxisColumn: sc.yAxisColumn,
          // JSON config is deep-copied by JSON.parse(JSON.stringify(...))
          // — a shared reference would let an edit on A2 mutate A1's
          // historical config, defeating the immutability invariant.
          // Caveat: this is JSON-safe only. Dates, Maps, NaN, Infinity
          // do NOT round-trip faithfully. The config schema is plain-
          // object today; if that changes, swap to structuredClone.
          config: sc.config ? JSON.parse(JSON.stringify(sc.config)) : sc.config,
          clientId: sc.clientId,
          clientName: sc.clientName,
          datasourceId: sc.datasourceId,
          datasetId: sc.datasetId,
          analysisId: newAnalysis.id,
          visualId: savedVisuals[i].id,
        }),
      );
      configSources.push({ src: sc, cloneIdx: configClones.length - 1 });
    });
    if (configClones.length > 0) {
      const savedConfigs = await manager
        .getRepository(VisualConfig)
        .save(configClones);
      configSources.forEach(({ src, cloneIdx }) =>
        visualConfigIdMap.set(src.id, savedConfigs[cloneIdx].id),
      );
    }
  }

  // ── 6. Clone AnalysisFilter rows ─────────────────────────────────
  const sourceFilters = await manager
    .getRepository(AnalysisFilter)
    .find({ where: { analysisId: source.id } });
  const filterIdMap = new Map<string, string>();
  const filterClones = sourceFilters.map(sf =>
    manager.getRepository(AnalysisFilter).create({
      analysisId: newAnalysis.id,
      name: sf.name,
      filterType: sf.filterType,
      columnName: sf.columnName,
      controlType: sf.controlType,
      // Same JSON deep-copy concern as VisualConfig.config above.
      config: sf.config ? JSON.parse(JSON.stringify(sf.config)) : sf.config,
      nullOption: sf.nullOption,
      isEnabled: sf.isEnabled,
      isMandatory: sf.isMandatory,
      sequence: sf.sequence,
      clientId: sf.clientId,
      clientName: sf.clientName,
      datasourceId: sf.datasourceId,
      datasetId: sf.datasetId,
      createdBy: loggedInId,
      updatedBy: loggedInId,
    }),
  );
  const savedFilters = filterClones.length
    ? await manager.getRepository(AnalysisFilter).save(filterClones)
    : [];
  sourceFilters.forEach((sf, i) => filterIdMap.set(sf.id, savedFilters[i].id));

  return {
    analysis: newAnalysis,
    idMap: {
      visualIds: visualIdMap,
      visualConfigIds: visualConfigIdMap,
      filterIds: filterIdMap,
      datasetFieldIds: fieldIdMap,
    },
  };
};

/**
 * Backfill helper: set `lineageId = id` on any Analyses row that
 * doesn't have one yet. Called as a one-shot during deploy after
 * the versioning columns ship.
 *
 * Only touches `lineageId`. Does NOT reset `versionNumber` — the
 * column default (1) already populated every legacy row at
 * migration time, and a row that has been intentionally edited
 * to a higher version (e.g. by a custom migration) must not be
 * clobbered to 1.
 *
 * Idempotent: scoped by `lineageId IS NULL`, so re-running has
 * no effect.
 */
export const backfillLineageIds = async (
  manager: EntityManager,
  clientId: string,
): Promise<number> => {
  const result = await manager
    .getRepository(Analyses)
    .createQueryBuilder()
    .update()
    .set({ lineageId: () => '"id"' })
    .where('clientId = :clientId', { clientId })
    .andWhere('lineageId IS NULL')
    .execute();
  return result.affected ?? 0;
};
