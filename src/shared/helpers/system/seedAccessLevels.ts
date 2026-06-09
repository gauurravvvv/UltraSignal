/**
 * seedAccessLevels — populates the `access_level` table with the four
 * canonical levels on first boot.
 *
 * Idempotent: each row upserts by `value`. Re-running on every boot
 * just refreshes labels/descriptions if they evolved. Safe to call
 * unconditionally inside the boot transaction.
 *
 * Keep these rows in sync with the ACCESS constant in
 * src/shared/constants/permissions/access.ts — the values are the
 * source of truth used by VerifyPermissionMiddleware comparisons.
 */
import { EntityManager } from 'typeorm';
import { AccessLevel } from '../../db/entities/access-level.entity';
import Logger from '../../utility/logger/logger';

interface LevelSeed {
  value: number;
  code: string;
  label: string;
  description: string;
  sequence: number;
}

const LEVELS: LevelSeed[] = [
  {
    value: 0,
    code: 'NONE',
    label: 'None',
    description: 'Screen is hidden. User cannot see or open this resource.',
    sequence: 1,
  },
  {
    value: 1,
    code: 'READ',
    label: 'Read',
    description: 'Can view lists and details. Cannot create, edit, or delete.',
    sequence: 2,
  },
  {
    value: 2,
    code: 'WRITE',
    label: 'Write',
    description: 'Can create and edit. Includes everything Read allows.',
    sequence: 3,
  },
  {
    value: 3,
    code: 'FULL',
    label: 'Full',
    description:
      'Full control — delete, bulk operations, password resets. Includes everything Write allows.',
    sequence: 4,
  },
];

const seedAccessLevels = async (manager: EntityManager): Promise<void> => {
  const repo = manager.getRepository(AccessLevel);
  for (const seed of LEVELS) {
    const existing = await repo.findOne({ where: { value: seed.value } });
    if (existing) {
      existing.code = seed.code;
      existing.label = seed.label;
      existing.description = seed.description;
      existing.sequence = seed.sequence;
      if (existing.status === 0) existing.status = 1;
      await repo.save(existing);
      continue;
    }
    const row = repo.create({
      value: seed.value,
      code: seed.code,
      label: seed.label,
      description: seed.description,
      sequence: seed.sequence,
      status: 1,
    });
    await repo.save(row);
  }
  Logger.info('Access-level catalog seeded / refreshed.');
};

export default seedAccessLevels;
