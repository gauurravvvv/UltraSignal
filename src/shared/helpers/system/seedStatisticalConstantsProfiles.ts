/**
 * seedStatisticalConstantsProfiles — populates
 * `statistical_constants_profile` with the system-default STANDARD
 * constants used by the disproportionality / Bayesian shrinkage
 * engines (z-scores, Haldane, IC shrinkage, GPS DuMouchel-1999 priors).
 *
 * Idempotent. Upserts by (code, scope, client_id = NULL). Editing this
 * file and restarting the server updates the constants for every tenant
 * that uses the system default — no per-tenant migration needed.
 */
import { EntityManager, IsNull } from 'typeorm';
import { Scope } from '../../db/entities/scope.entity';
import { StatisticalConstantsProfile } from '../../db/entities/statistical-constants-profile.entity';
import Logger from '../../utility/logger/logger';

interface ConstantsSeed {
  code: string;
  displayName: string;
  description: string;
  scopeCode: string;
  isDefault: boolean;
  isEnabled: boolean;
  z95: number;
  z90: number;
  haldane: number;
  icK: number;
  ebgmW: number;
  ebgmA1: number;
  ebgmB1: number;
  ebgmA2: number;
  ebgmB2: number;
}

const CATALOG: ConstantsSeed[] = [
  {
    code: 'STANDARD',
    displayName: 'Standard constants (DuMouchel 1999)',
    description:
      'Engine defaults: 95/90% CI z, Haldane 0.5, IC shrinkage 0.5, GPS DuMouchel-1999 priors',
    scopeCode: 'system',
    isDefault: true,
    isEnabled: true,
    z95: 1.96,
    z90: 1.645,
    haldane: 0.5,
    icK: 0.5,
    ebgmW: 0.0969,
    ebgmA1: 0.2041,
    ebgmB1: 0.05816,
    ebgmA2: 1.415,
    ebgmB2: 1.838,
  },
];

const seedStatisticalConstantsProfiles = async (
  manager: EntityManager,
): Promise<void> => {
  const profileRepo = manager.getRepository(StatisticalConstantsProfile);
  const scopeRepo = manager.getRepository(Scope);

  for (const c of CATALOG) {
    const scope = await scopeRepo.findOne({ where: { code: c.scopeCode } });
    if (!scope) {
      throw new Error(
        `seedStatisticalConstantsProfiles: scope code "${c.scopeCode}" ` +
          `not found. Did seedScopes run first?`,
      );
    }

    const existing = await profileRepo.findOne({
      where: {
        code: c.code,
        scopeId: scope.scopeId,
        clientId: IsNull(),
      },
    });

    if (existing) {
      existing.displayName = c.displayName;
      existing.description = c.description;
      existing.isDefault = c.isDefault;
      existing.isEnabled = c.isEnabled;
      existing.z95 = c.z95;
      existing.z90 = c.z90;
      existing.haldane = c.haldane;
      existing.icK = c.icK;
      existing.ebgmW = c.ebgmW;
      existing.ebgmA1 = c.ebgmA1;
      existing.ebgmB1 = c.ebgmB1;
      existing.ebgmA2 = c.ebgmA2;
      existing.ebgmB2 = c.ebgmB2;
      await profileRepo.save(existing);
      continue;
    }
    const created = profileRepo.create({
      code: c.code,
      displayName: c.displayName,
      description: c.description,
      scopeId: scope.scopeId,
      clientId: null,
      isDefault: c.isDefault,
      isEnabled: c.isEnabled,
      z95: c.z95,
      z90: c.z90,
      haldane: c.haldane,
      icK: c.icK,
      ebgmW: c.ebgmW,
      ebgmA1: c.ebgmA1,
      ebgmB1: c.ebgmB1,
      ebgmA2: c.ebgmA2,
      ebgmB2: c.ebgmB2,
    });
    await profileRepo.save(created);
  }

  Logger.info('Statistical constants profile catalog seeded / refreshed.');
};

export default seedStatisticalConstantsProfiles;
