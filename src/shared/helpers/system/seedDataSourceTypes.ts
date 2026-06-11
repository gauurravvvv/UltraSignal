/**
 * seedDataSourceTypes — populates the `data_source_type` catalog with
 * the upstream systems UltraSignal supports (AEMS, UAN, ...).
 *
 * Idempotent: each row is upserted by its unique `sourceId`. Re-running
 * the seed on every boot just refreshes the display name / sequence if
 * the catalog evolved. Adding a new type later is a one-line change in
 * the CATALOG array.
 *
 * Scope is fixed to 'SYSTEM' — platform-defined sources visible to every
 * client. If an 'ORG'-scope (tenant-defined) source becomes a need, add
 * a `scope` field to the seed entry and tighten the listDataSourceType
 * controller to filter by the caller's scope.
 */
import { EntityManager } from 'typeorm';
import { DataSourceType } from '../../db/entities/data-source-type.entity';
import Logger from '../../utility/logger/logger';

interface DataSourceTypeSeed {
  sourceId: string;
  name: string;
  sequence: number;
}

const CATALOG: DataSourceTypeSeed[] = [
  { sourceId: 'AEMS', name: 'AEMS', sequence: 1 },
  { sourceId: 'UAN', name: 'UAN', sequence: 2 },
];

const seedDataSourceTypes = async (
  manager: EntityManager,
): Promise<void> => {
  const repo = manager.getRepository(DataSourceType);

  for (const t of CATALOG) {
    const existing = await repo.findOne({ where: { sourceId: t.sourceId } });
    if (existing) {
      existing.name = t.name;
      existing.sequence = t.sequence;
      existing.scope = 'SYSTEM';
      if (existing.status === 0) existing.status = 1;
      await repo.save(existing);
      continue;
    }
    const created = repo.create({
      sourceId: t.sourceId,
      name: t.name,
      sequence: t.sequence,
      scope: 'SYSTEM',
      status: 1,
    });
    await repo.save(created);
  }

  Logger.info('Data source type catalog seeded / refreshed.');
};

export default seedDataSourceTypes;
