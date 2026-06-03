import { EntityManager, In } from 'typeorm';
import { Analyses } from '../db/entities/analyses.entity';
import { AnalysisFilter } from '../db/entities/analysis_filter.entity';
import { DatasourceConnection } from '../db/entities/connections.entity';
import { Dataset } from '../db/entities/dataset.entity';
import { DatasetField } from '../db/entities/datasetField.entity';
import { DatasetFieldRelation } from '../db/entities/datasetFieldRelation.entity';
import { DatasourceAccess } from '../db/entities/datasource_access.entity';
import { Prompt } from '../db/entities/prompt.entity';
import { PromptConfig } from '../db/entities/promptConfig.entity';
import { PromptValue } from '../db/entities/promptValue.entity';
import { QueryBuilder as QBEntity } from '../db/entities/queryBuilder.entity';
import { QueryBuilderPrompts } from '../db/entities/queryBuilderPrompts.entity';
import { Section } from '../db/entities/section.entity';
import { Tab } from '../db/entities/tab.entity';
import { Visual } from '../db/entities/visual.entity';
import { VisualConfig } from '../db/entities/visual_config.entity';
import Logger from './logger/logger';

/**
 * Bulk soft-delete: Sets deletedBy + deletedOn in a single UPDATE.
 * Only affects records where deletedOn IS NULL (not already deleted).
 */
async function softDeleteBy(
  manager: EntityManager,
  entity: Function,
  column: string,
  value: string | string[],
  deletedBy: string,
): Promise<number> {
  const isArray = Array.isArray(value);
  if (isArray && (value as string[]).length === 0) return 0;

  const qb = manager
    .getRepository(entity)
    .createQueryBuilder()
    .update()
    .set({ deletedBy, deletedOn: () => 'NOW()' } as any);

  if (isArray) {
    qb.where(`"${column}" IN (:...values)`, { values: value });
  } else {
    qb.where(`"${column}" = :value`, { value });
  }

  qb.andWhere('"deletedOn" IS NULL');

  const result = await qb.execute();
  return result.affected || 0;
}

/**
 * Get non-deleted entity IDs by a column condition.
 * Entities with @DeleteDateColumn are auto-filtered by TypeORM's find().
 */
async function getActiveIds(
  manager: EntityManager,
  entity: Function,
  column: string,
  value: string | string[],
): Promise<string[]> {
  if (Array.isArray(value) && value.length === 0) return [];

  const where: any = {};
  where[column] = Array.isArray(value) ? In(value) : value;

  const records = await manager.getRepository(entity).find({
    where,
    select: ['id'],
  });
  return records.map((r: any) => r.id);
}

// ============================================================
// CASCADE FUNCTIONS
// ============================================================

/**
 * Hard-delete prompt children: PromptConfig, PromptValue
 */
export async function cascadePromptChildren(
  manager: EntityManager,
  promptIds: string[],
): Promise<void> {
  if (promptIds.length === 0) return;
  await manager.getRepository(PromptConfig).delete({ promptId: In(promptIds) });
  await manager.getRepository(PromptValue).delete({ promptId: In(promptIds) });
}

/**
 * Cascade for analysis deletion.
 *
 * Hard-deletes the analysis's owned child rows (VisualConfig, Visual,
 * AnalysisFilter) — these are tightly coupled to a specific analysis
 * version and have no meaning without their parent.
 *
 * **Limitation — restoration is not symmetric.** Visual, VisualConfig
 * and AnalysisFilter do not carry an `@DeleteDateColumn`, so a
 * soft-delete-then-restore on the Analyses row does NOT bring back
 * the children that this function hard-deleted. The Analyses row
 * comes back empty. Treat soft-delete of an analysis (or its source
 * dataset, which cascades here) as effectively destructive for that
 * analysis's children. Dashboards pinned to the analysis-version do
 * survive — they have their own snapshot tables — but live analysis
 * editing on the restored row starts from scratch. If full restore
 * fidelity is required, add @DeleteDateColumn to Visual,
 * VisualConfig, and AnalysisFilter and switch these `.delete` calls
 * to `.softDelete`.
 *
 * **Dashboards are NOT touched.** Under the live-dataset + snapshot-
 * dashboard model, dashboards are immutable publications that point
 * at the analysis they were published from via `sourceAnalysisId`.
 * Deleting the underlying analysis must NOT corrupt the dashboard;
 * the dashboard's renderer (resolveLiveDatasetSql in particular)
 * will surface a clean "source dataset / analysis no longer available"
 * error to the user when the deleted analysis is followed, and the
 * dashboard row survives so an admin can restore from soft-delete
 * or republish.
 *
 * (The previous version of this helper attempted
 *   softDeleteBy(manager, Dashboard, 'analysisId', ...)
 * which referenced a column that doesn't exist on Dashboard — the
 * correct column would have been `sourceAnalysisId` — so the call
 * was a silent no-op in Postgres. Removed entirely; the desired
 * behaviour is exactly the no-op.)
 */
export async function cascadeAnalysisChildren(
  manager: EntityManager,
  analysisIds: string[],
  _deletedBy: string,
): Promise<void> {
  if (analysisIds.length === 0) return;
  await manager
    .getRepository(VisualConfig)
    .delete({ analysisId: In(analysisIds) });
  await manager.getRepository(Visual).delete({ analysisId: In(analysisIds) });
  await manager
    .getRepository(AnalysisFilter)
    .delete({ analysisId: In(analysisIds) });
  // Dashboards intentionally NOT touched — see helper docblock.
}

/**
 * Cascade for dataset deletion.
 *
 * Hard-deletes the dataset's owned child rows (DatasetFieldRelation,
 * DatasetField). Soft-deletes any analyses pointing at the dataset.
 *
 * Cascade through analyses → their owned child rows (Visual, etc.)
 * happens via `cascadeAnalysisChildren`.
 *
 * **Dashboards are NOT touched.** They survive as snapshots. When the
 * user later tries to render a dashboard whose source dataset has
 * been soft-deleted, `resolveLiveDatasetSql` throws and the dashboard
 * runtime controllers translate that to a 404 with a clear message.
 * Restoring the dataset (un-soft-delete) restores dashboard renders.
 */
export async function cascadeDatasetChildren(
  manager: EntityManager,
  datasetIds: string[],
  deletedBy: string,
): Promise<void> {
  if (datasetIds.length === 0) return;

  // Cascade analyses → their children (Visual / VisualConfig /
  // AnalysisFilter), then soft-delete the analyses themselves. We
  // do NOT touch dashboards — they survive deliberately so they can
  // be restored if the dataset comes back.
  const analysisIds = await getActiveIds(
    manager,
    Analyses,
    'datasetId',
    datasetIds,
  );
  await cascadeAnalysisChildren(manager, analysisIds, deletedBy);
  await softDeleteBy(manager, Analyses, 'datasetId', datasetIds, deletedBy);

  // Hard-delete dataset field relations, then fields
  const fieldIds = await getActiveIds(
    manager,
    DatasetField,
    'datasetId',
    datasetIds,
  );
  if (fieldIds.length > 0) {
    await manager
      .getRepository(DatasetFieldRelation)
      .delete({ fieldId: In(fieldIds) });
    await manager
      .getRepository(DatasetFieldRelation)
      .delete({ referencedFieldId: In(fieldIds) });
  }
  await manager
    .getRepository(DatasetField)
    .delete({ datasetId: In(datasetIds) });
}

/**
 * Cascade for section deletion:
 * Soft-delete prompts + hard-delete their children
 * Soft-delete QueryBuilderPrompts referencing these sections
 */
export async function cascadeSectionChildren(
  manager: EntityManager,
  sectionIds: string[],
  deletedBy: string,
): Promise<void> {
  if (sectionIds.length === 0) return;
  const promptIds = await getActiveIds(
    manager,
    Prompt,
    'sectionId',
    sectionIds,
  );
  await cascadePromptChildren(manager, promptIds);
  await softDeleteBy(manager, Prompt, 'sectionId', sectionIds, deletedBy);
  await softDeleteBy(
    manager,
    QueryBuilderPrompts,
    'sectionId',
    sectionIds,
    deletedBy,
  );
}

/**
 * Cascade for tab deletion:
 * Soft-delete sections + prompts, hard-delete prompt children
 * Soft-delete QueryBuilderPrompts referencing these tabs
 */
export async function cascadeTabChildren(
  manager: EntityManager,
  tabIds: string[],
  deletedBy: string,
): Promise<void> {
  if (tabIds.length === 0) return;

  // Cascade sections → prompts → prompt children
  const sectionIds = await getActiveIds(manager, Section, 'tabId', tabIds);
  await cascadeSectionChildren(manager, sectionIds, deletedBy);
  await softDeleteBy(manager, Section, 'tabId', tabIds, deletedBy);
  await softDeleteBy(manager, QueryBuilderPrompts, 'tabId', tabIds, deletedBy);
}

/**
 * Cascade for connection deletion:
 * Hard-delete DatasourceAccess
 */
export async function cascadeConnectionChildren(
  manager: EntityManager,
  connectionIds: string[],
): Promise<void> {
  if (connectionIds.length === 0) return;
  await manager
    .getRepository(DatasourceAccess)
    .delete({ connectionId: In(connectionIds) });
}

/**
 * Cascade for query builder deletion:
 * Soft-delete QueryBuilderPrompts (has @DeleteDateColumn)
 */
export async function cascadeQueryBuilderChildren(
  manager: EntityManager,
  queryBuilderIds: string[],
  deletedBy: string,
): Promise<void> {
  if (queryBuilderIds.length === 0) return;
  await softDeleteBy(
    manager,
    QueryBuilderPrompts,
    'queryBuilderId',
    queryBuilderIds,
    deletedBy,
  );
}

/**
 * Full cascade soft-delete for a DatasourceS.
 * Handles the entire entity tree under a datasource.
 */
export async function cascadeDatasourceChildren(
  manager: EntityManager,
  datasourceId: string,
  deletedBy: string,
): Promise<void> {
  Logger.info(`Cascade soft-delete for datasource: ${datasourceId}`);

  // 1. Prompts + children (PromptConfig, PromptValue)
  const promptIds = await getActiveIds(
    manager,
    Prompt,
    'datasourceId',
    datasourceId,
  );
  await cascadePromptChildren(manager, promptIds);
  await softDeleteBy(manager, Prompt, 'datasourceId', datasourceId, deletedBy);

  // 2. Sections
  await softDeleteBy(manager, Section, 'datasourceId', datasourceId, deletedBy);

  // 3. Tabs
  await softDeleteBy(manager, Tab, 'datasourceId', datasourceId, deletedBy);

  // 4. Analyses + children (Visual, VisualConfig, AnalysisFilter, Dashboard)
  const analysisIds = await getActiveIds(
    manager,
    Analyses,
    'datasourceId',
    datasourceId,
  );
  await cascadeAnalysisChildren(manager, analysisIds, deletedBy);
  await softDeleteBy(
    manager,
    Analyses,
    'datasourceId',
    datasourceId,
    deletedBy,
  );

  // 5. Datasets + children (DatasetFieldRelation, DatasetField)
  const datasetIds = await getActiveIds(
    manager,
    Dataset,
    'datasourceId',
    datasourceId,
  );
  if (datasetIds.length > 0) {
    const fieldIds = await getActiveIds(
      manager,
      DatasetField,
      'datasetId',
      datasetIds,
    );
    if (fieldIds.length > 0) {
      await manager
        .getRepository(DatasetFieldRelation)
        .delete({ fieldId: In(fieldIds) });
      await manager
        .getRepository(DatasetFieldRelation)
        .delete({ referencedFieldId: In(fieldIds) });
    }
    await manager
      .getRepository(DatasetField)
      .delete({ datasetId: In(datasetIds) });
  }
  await softDeleteBy(manager, Dataset, 'datasourceId', datasourceId, deletedBy);

  // 6. Connections + DatasourceAccess
  const connectionIds = await getActiveIds(
    manager,
    DatasourceConnection,
    'datasourceId',
    datasourceId,
  );
  await cascadeConnectionChildren(manager, connectionIds);
  await softDeleteBy(
    manager,
    DatasourceConnection,
    'datasourceId',
    datasourceId,
    deletedBy,
  );

  // 7. QueryBuilders + QueryBuilderPrompts
  const qbIds = await getActiveIds(
    manager,
    QBEntity,
    'datasourceId',
    datasourceId,
  );
  await cascadeQueryBuilderChildren(manager, qbIds, deletedBy);
  await softDeleteBy(
    manager,
    QBEntity,
    'datasourceId',
    datasourceId,
    deletedBy,
  );

  Logger.info(`Cascade soft-delete completed for datasource: ${datasourceId}`);
}
