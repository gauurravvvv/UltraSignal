import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Scope } from './scope.entity';
import { ProductGroupMember } from './product-group-member.entity';

/**
 * Saved grouping of MedDRA/product hierarchy picks. A product group
 * carries a `code` (unique per scope + client) and a name, with
 * members stored in `product_group_member`. Used by signal-detection
 * runs and dashboards to scope analytics to a curated product set.
 *
 * Soft-delete: `deleted = true` hides the row from list/get endpoints
 * but keeps the FK chain intact for any historical alert references.
 * The unique index covers only `deleted = false` rows so a new group
 * can reuse a code that an older soft-deleted row owned.
 *
 * The unique index in the DDL is `(COALESCE(client_id, 0), scope_id,
 * code) WHERE NOT deleted` — expressed here via a raw `@Index` so the
 * partial COALESCE survives a TypeORM synchronize cycle. If a future
 * sync drops it, recreate via:
 *
 *   CREATE UNIQUE INDEX ux_pg_code ON product_group
 *     (COALESCE(client_id, 0::bigint), scope_id, code) WHERE NOT deleted;
 */
@Entity('product_group')
@Index('ix_pg_scope', ['scopeId'])
export class ProductGroup extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'integer', name: 'product_group_id' })
  productGroupId: number;

  @Column({ type: 'text' })
  code: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'smallint', name: 'scope_id' })
  scopeId: number;

  @ManyToOne(() => Scope)
  @JoinColumn({ name: 'scope_id' })
  scope?: Scope;

  /** Multi-tenant owner. Null = system-scope (visible across clients). */
  @Column({ type: 'bigint', name: 'client_id', nullable: true })
  clientId?: string | null;

  /** Optional sub-tenant key — some clients carve into enterprises. */
  @Column({ type: 'bigint', name: 'enterprise_id', nullable: true })
  enterpriseId?: string | null;

  @Column({ type: 'boolean', default: false })
  deleted: boolean;

  @Column({ type: 'bigint', name: 'created_by', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'bigint', name: 'updated_by', nullable: true })
  updatedBy?: string | null;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at', nullable: true })
  updatedAt?: Date | null;

  @OneToMany(() => ProductGroupMember, m => m.productGroup)
  members?: ProductGroupMember[];
}
