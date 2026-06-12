import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
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
 * carries a `code` (unique per scope + client when not soft-deleted)
 * and a name; the picks live in `product_group_member`. Used by
 * signal-detection runs and dashboards to scope analytics to a
 * curated product set.
 *
 * Soft-delete via TypeORM's `@DeleteDateColumn` (`deleted_on`) +
 * an audit `deleted_by` — same pattern as `Role` / `User`. List
 * endpoints filter out soft-deleted rows; the partial unique index
 * lets a deleted code be reused by a new row.
 *
 * The partial unique index `(COALESCE(client_id, 0), scope_id, code)
 * WHERE deleted_on IS NULL` from the DDL isn't expressible via TypeORM
 * decorators — recreate after sync via:
 *
 *   CREATE UNIQUE INDEX ux_pg_code ON product_group
 *     (COALESCE(client_id, 0::bigint), scope_id, code)
 *     WHERE deleted_on IS NULL;
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

  /** Free-form description, ≤ 500 chars (enforced at the validator). */
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'smallint', name: 'scope_id' })
  scopeId: number;

  @ManyToOne(() => Scope)
  @JoinColumn({ name: 'scope_id' })
  scope?: Scope;

  /** Multi-tenant owner — stamped with `clientData.clientCode` at
   *  create time. Null = system-scope (visible across clients). */
  @Column({ type: 'text', name: 'client_id', nullable: true })
  clientId?: string | null;

  /** Optional sub-tenant key — some clients carve into enterprises. */
  @Column({ type: 'bigint', name: 'enterprise_id', nullable: true })
  enterpriseId?: string | null;

  /** 1 = Active, 0 = Inactive. Edited via Edit page; defaults to
   *  Active on create. */
  @Column({ type: 'boolean', name: 'is_enabled', default: true })
  isEnabled: boolean;

  /* Audit columns store the caller's user id, which is a UUID across
   * this codebase (User.id is uuid). Using `text` keeps the column
   * type-flexible and matches the convention in `Role` / `User`. */
  @Column({ type: 'text', name: 'created_by', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'text', name: 'updated_by', nullable: true })
  updatedBy?: string | null;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at', nullable: true })
  updatedAt?: Date | null;

  /** Soft-delete: set automatically by TypeORM's `softRemove`. List
   *  endpoints add `WHERE deleted_on IS NULL` to hide these rows. */
  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_on', nullable: true })
  deletedOn?: Date | null;

  @Column({ type: 'text', name: 'deleted_by', nullable: true })
  deletedBy?: string | null;

  @OneToMany(() => ProductGroupMember, m => m.productGroup)
  members?: ProductGroupMember[];
}
