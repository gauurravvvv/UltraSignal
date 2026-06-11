/**
 * seedScopes — populates the `scope` reference catalog with the four
 * analysis scopes (System, Organization, User, Ad-hoc).
 *
 * Idempotent: each row upserts by its stable `code`. Re-running just
 * refreshes `display_name` / `description` if they were edited in this
 * file. `scope_id` is auto-assigned by Postgres; downstream seeders look
 * up the FK target by `code`, not by hard-coded id, so the integers
 * don't have to match the original DDL exactly.
 */
import { EntityManager } from 'typeorm';
import { Scope } from '../../db/entities/scope.entity';
import Logger from '../../utility/logger/logger';

interface ScopeSeed {
  code: string;
  displayName: string;
  description: string;
}

const CATALOG: ScopeSeed[] = [
  {
    code: 'system',
    displayName: 'System',
    description:
      'Built-in preset — reusable sets only (never alerts); global; locked',
  },
  {
    code: 'org',
    displayName: 'Organization',
    description:
      'Shared within the client / enterprise — sets AND org-level alerts',
  },
  {
    code: 'user',
    displayName: 'User',
    description: 'Owned by one user — sets AND user-level alerts',
  },
  {
    code: 'adhoc',
    displayName: 'Ad-hoc',
    description:
      'One-off / unnamed — ad-hoc runs + unsaved selections; never an alert scope',
  },
];

const seedScopes = async (manager: EntityManager): Promise<void> => {
  const repo = manager.getRepository(Scope);

  for (const s of CATALOG) {
    const existing = await repo.findOne({ where: { code: s.code } });
    if (existing) {
      existing.displayName = s.displayName;
      existing.description = s.description;
      await repo.save(existing);
      continue;
    }
    const created = repo.create({
      code: s.code,
      displayName: s.displayName,
      description: s.description,
    });
    await repo.save(created);
  }

  Logger.info('Scope catalog seeded / refreshed.');
};

export default seedScopes;
