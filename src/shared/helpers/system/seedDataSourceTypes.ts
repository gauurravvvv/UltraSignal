/**
 * seedDataSourceTypes — populates the `data_source_type` catalog with
 * the upstream systems UltraSignal supports (AEMS, UAN, ...).
 *
 * Idempotent: each row is upserted by its stable `sourceId` integer.
 * Re-running the seed on every boot just refreshes the display name if
 * the catalog evolved.
 *
 * `sourceId` is the stable identifier — once assigned to a name, never
 * change it (consumers reference rows by sourceId). Adding a new type
 * means appending to the bottom of the array with the next free integer.
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
  sourceId: number;
  name: string;
}

const CATALOG: DataSourceTypeSeed[] = [
  { sourceId: 1, name: 'AEMS' },
  { sourceId: 2, name: 'UAN' },
];

const seedDataSourceTypes = async (
  manager: EntityManager,
): Promise<void> => {
  const repo = manager.getRepository(DataSourceType);

  for (const t of CATALOG) {
    const existing = await repo.findOne({ where: { sourceId: t.sourceId } });
    if (existing) {
      existing.name = t.name;
      existing.scope = 'SYSTEM';
      if (existing.status === 0) existing.status = 1;
      await repo.save(existing);
      continue;
    }
    const created = repo.create({
      sourceId: t.sourceId,
      name: t.name,
      scope: 'SYSTEM',
      status: 1,
    });
    await repo.save(created);
  }

  Logger.info('Data source type catalog seeded / refreshed.');
};

export default seedDataSourceTypes;
