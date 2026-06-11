/**
 * seedThresholdProfiles — populates the `threshold_profile` catalog with
 * the system-default STANDARD profile and its 7 conditions
 * (a, prr, prr025, ror05, ic025, ebgm, eb05).
 *
 * Idempotent. The profile upserts by (code, scope, client_id = NULL).
 * Conditions are wholesale-replaced on every run: we delete every
 * condition belonging to the profile and re-insert the canonical set.
 * That's safe because system-default profiles are not user-editable —
 * tenants who want a custom set create their OWN profile and the
 * wholesale replace only touches the seeded one.
 *
 * The profile references `scope` by `code` (looked up at runtime),
 * not by hard-coded `scope_id`, so this seeder is order-independent
 * with respect to the scope auto-increment.
 */
import { EntityManager, IsNull } from 'typeorm';
import { Scope } from '../../db/entities/scope.entity';
import { ThresholdCondition } from '../../db/entities/threshold-condition.entity';
import { ThresholdProfile } from '../../db/entities/threshold-profile.entity';
import Logger from '../../utility/logger/logger';

interface ConditionSeed {
  metric: string;
  operator: string;
  value: number;
}

interface ProfileSeed {
  code: string;
  displayName: string;
  description: string;
  scopeCode: string;
  isDefault: boolean;
  isEnabled: boolean;
  conditions: ConditionSeed[];
}

const CATALOG: ProfileSeed[] = [
  {
    code: 'STANDARD',
    displayName: 'Standard SDR (EMA/FDA)',
    description:
      'All-four-detector house standard: count + PRR + PRR025 + ROR05 + IC025 + EBGM + EB05',
    scopeCode: 'system',
    isDefault: true,
    isEnabled: true,
    conditions: [
      { metric: 'a', operator: '>=', value: 3.0 },
      { metric: 'prr', operator: '>=', value: 2.0 },
      { metric: 'prr025', operator: '>=', value: 1.0 },
      { metric: 'ror05', operator: '>=', value: 1.0 },
      { metric: 'ic025', operator: '>', value: 0.0 },
      { metric: 'ebgm', operator: '>=', value: 2.0 },
      { metric: 'eb05', operator: '>=', value: 2.0 },
    ],
  },
];

const seedThresholdProfiles = async (
  manager: EntityManager,
): Promise<void> => {
  const profileRepo = manager.getRepository(ThresholdProfile);
  const conditionRepo = manager.getRepository(ThresholdCondition);
  const scopeRepo = manager.getRepository(Scope);

  for (const p of CATALOG) {
    const scope = await scopeRepo.findOne({ where: { code: p.scopeCode } });
    if (!scope) {
      throw new Error(
        `seedThresholdProfiles: scope code "${p.scopeCode}" not found. ` +
          `Did seedScopes run first?`,
      );
    }

    // System-default profile is uniquely identified by (code, scopeId,
    // client_id IS NULL). Use IsNull() to make TypeORM emit the correct
    // SQL — `clientId: null` would compile to `= NULL` which never matches.
    let profile = await profileRepo.findOne({
      where: {
        code: p.code,
        scopeId: scope.scopeId,
        clientId: IsNull(),
      },
    });

    if (profile) {
      profile.displayName = p.displayName;
      profile.description = p.description;
      profile.isDefault = p.isDefault;
      profile.isEnabled = p.isEnabled;
      profile = await profileRepo.save(profile);
    } else {
      profile = profileRepo.create({
        code: p.code,
        displayName: p.displayName,
        description: p.description,
        scopeId: scope.scopeId,
        clientId: null,
        isDefault: p.isDefault,
        isEnabled: p.isEnabled,
      });
      profile = await profileRepo.save(profile);
    }

    // Wholesale-replace this profile's conditions. Safe for system seed
    // profiles since tenants don't add custom conditions to a shared
    // profile — they create their own profile + conditions instead.
    await conditionRepo.delete({ thresholdProfileId: profile.thresholdProfileId });

    const rows = p.conditions.map(c =>
      conditionRepo.create({
        thresholdProfileId: profile!.thresholdProfileId,
        metric: c.metric,
        operator: c.operator,
        value: c.value,
        isEnabled: true,
      }),
    );
    await conditionRepo.save(rows);
  }

  Logger.info('Threshold profile catalog seeded / refreshed.');
};

export default seedThresholdProfiles;
