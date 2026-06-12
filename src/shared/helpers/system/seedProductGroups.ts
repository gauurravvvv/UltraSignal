/**
 * seedProductGroups — populates the `product_group` + `product_group_member`
 * fixtures lifted from product_group_*.csv. Idempotent: upserts by id so
 * the assigned PKs stay stable across boots and downstream FKs don't
 * drift.
 *
 * Runs AFTER `seedScopes` because every fixture row references a scope
 * by code (we resolve the FK target at runtime instead of trusting the
 * id baked into the CSV, since `scope_id` is auto-assigned).
 *
 * The CSVs use `scope_id=2` which corresponds to the `org` scope on
 * the legacy box. We map by code here so the fixture survives a fresh
 * sync where `org` gets a different `scope_id`.
 */
import { EntityManager } from 'typeorm';
import { ProductGroup } from '../../db/entities/product-group.entity';
import { ProductGroupMember } from '../../db/entities/product-group-member.entity';
import { Scope } from '../../db/entities/scope.entity';
import Logger from '../../utility/logger/logger';

interface ProductGroupSeed {
  productGroupId: number;
  code: string;
  name: string;
  scopeCode: string;
  clientId: string | null;
  enterpriseId: string | null;
}

interface ProductGroupMemberSeed {
  productGroupMemberId: number;
  productGroupId: number;
  memberType: 'product' | 'group';
  sourceSystem: string | null;
  level: string | null;
  code: string | null;
  parentProductGroupId: number | null;
  name: string | null;
}

const GROUPS: ProductGroupSeed[] = [
  {
    productGroupId: 1,
    code: 'ONCOLOGY_PORTFOLIO',
    name: 'Oncology portfolio',
    scopeCode: 'org',
    clientId: '9999',
    enterpriseId: '13',
  },
  {
    productGroupId: 2,
    code: 'BIOSIMILARS',
    name: 'Biosimilars',
    scopeCode: 'org',
    clientId: '9999',
    enterpriseId: '13',
  },
];

const MEMBERS: ProductGroupMemberSeed[] = [
  {
    productGroupMemberId: 1,
    productGroupId: 2,
    memberType: 'product',
    sourceSystem: 'AEMS',
    level: 'ingredient',
    code: '327361',
    parentProductGroupId: null,
    name: 'adalimumab',
  },
  {
    productGroupMemberId: 2,
    productGroupId: 2,
    memberType: 'product',
    sourceSystem: 'AEMS',
    level: 'ingredient',
    code: null,
    parentProductGroupId: null,
    name: 'adalimumab-aacf',
  },
  {
    productGroupMemberId: 3,
    productGroupId: 2,
    memberType: 'product',
    sourceSystem: 'AEMS',
    level: 'ingredient',
    code: null,
    parentProductGroupId: null,
    name: 'adalimumab-adbm',
  },
  {
    productGroupMemberId: 4,
    productGroupId: 1,
    memberType: 'product',
    sourceSystem: 'UAN',
    level: 'ingredient',
    code: '112993',
    parentProductGroupId: null,
    name: 'Abacavir hydrochloride',
  },
  {
    productGroupMemberId: 5,
    productGroupId: 1,
    memberType: 'group',
    sourceSystem: null,
    level: null,
    code: 'BIOSIMILARS',
    parentProductGroupId: 2,
    name: 'Biosimilars',
  },
];

const seedProductGroups = async (manager: EntityManager): Promise<void> => {
  const scopeRepo = manager.getRepository(Scope);
  const groupRepo = manager.getRepository(ProductGroup);
  const memberRepo = manager.getRepository(ProductGroupMember);

  /* Resolve scope FK by code so the seed survives a re-numbered
   * scope_id. Bail loudly if the prerequisite seeder hasn't run. */
  const scopes = await scopeRepo.find();
  const scopeIdByCode = new Map(scopes.map(s => [s.code, s.scopeId]));

  for (const g of GROUPS) {
    const scopeId = scopeIdByCode.get(g.scopeCode);
    if (scopeId === undefined) {
      throw new Error(
        `[seedProductGroups] scope code "${g.scopeCode}" not found. ` +
          `Did seedScopes run first?`,
      );
    }

    const existing = await groupRepo.findOne({
      where: { productGroupId: g.productGroupId },
    });
    if (existing) {
      existing.code = g.code;
      existing.name = g.name;
      existing.scopeId = scopeId;
      existing.clientId = g.clientId;
      existing.enterpriseId = g.enterpriseId;
      existing.deletedOn = null;
      await groupRepo.save(existing);
      continue;
    }
    const created = groupRepo.create({
      productGroupId: g.productGroupId,
      code: g.code,
      name: g.name,
      scopeId,
      clientId: g.clientId,
      enterpriseId: g.enterpriseId,
      isEnabled: true,
    });
    await groupRepo.save(created);
  }

  for (const m of MEMBERS) {
    const existing = await memberRepo.findOne({
      where: { productGroupMemberId: m.productGroupMemberId },
    });
    if (existing) {
      existing.productGroupId = m.productGroupId;
      existing.memberType = m.memberType;
      existing.sourceSystem = m.sourceSystem;
      existing.level = m.level;
      existing.code = m.code;
      existing.parentProductGroupId = m.parentProductGroupId;
      existing.name = m.name;
      existing.deletedOn = null;
      await memberRepo.save(existing);
      continue;
    }
    const created = memberRepo.create({
      productGroupMemberId: m.productGroupMemberId,
      productGroupId: m.productGroupId,
      memberType: m.memberType,
      sourceSystem: m.sourceSystem,
      level: m.level,
      code: m.code,
      parentProductGroupId: m.parentProductGroupId,
      name: m.name,
    });
    await memberRepo.save(created);
  }

  Logger.info('Product group fixtures seeded / refreshed.');
};

export default seedProductGroups;
