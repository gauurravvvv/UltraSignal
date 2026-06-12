import {
  BaseEntity,
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductGroup } from './product-group.entity';

/**
 * A member of a product group. Two shapes share this table:
 *
 *   - `member_type='product'` — a hierarchy pick from the product
 *     catalog. Carries `source_system`, `level`, `name`, and (when
 *     the catalog ships one) `code`. `parent_product_group_id` is null.
 *
 *   - `member_type='group'` — a nested product group reference.
 *     Carries `code` (the child group's code) and
 *     `parent_product_group_id` (FK to product_group).
 *     `source_system`, `level` are null.
 *
 * The CHECK constraint enforces the shape disjunction; the partial
 * index on `parent_product_group_id` keeps nested-group lookups fast
 * when most rows are products.
 *
 * Soft-delete via `@DeleteDateColumn` mirrors the parent entity.
 */
@Entity('product_group_member')
@Index('ix_pgm_group', ['productGroupId'])
@Check(
  `(
    (member_type = 'product'
       AND level IS NOT NULL
       AND source_system IS NOT NULL
       AND name IS NOT NULL
       AND parent_product_group_id IS NULL)
    OR
    (member_type = 'group'
       AND code IS NOT NULL
       AND parent_product_group_id IS NOT NULL
       AND level IS NULL
       AND source_system IS NULL)
  )`,
)
@Check(`member_type IN ('product', 'group')`)
export class ProductGroupMember extends BaseEntity {
  @PrimaryGeneratedColumn({
    type: 'integer',
    name: 'product_group_member_id',
  })
  productGroupMemberId: number;

  @Column({ type: 'integer', name: 'product_group_id' })
  productGroupId: number;

  @ManyToOne(() => ProductGroup, g => g.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_group_id' })
  productGroup?: ProductGroup;

  @Column({ type: 'text', name: 'member_type' })
  memberType: 'product' | 'group';

  @Column({ type: 'text', name: 'source_system', nullable: true })
  sourceSystem?: string | null;

  @Column({ type: 'text', nullable: true })
  level?: string | null;

  @Column({ type: 'text', nullable: true })
  code?: string | null;

  @Column({ type: 'integer', name: 'parent_product_group_id', nullable: true })
  parentProductGroupId?: number | null;

  @ManyToOne(() => ProductGroup)
  @JoinColumn({ name: 'parent_product_group_id' })
  parentProductGroup?: ProductGroup;

  @Column({ type: 'text', nullable: true })
  name?: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'tgt_insert_date_time' })
  tgtInsertDateTime: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_on', nullable: true })
  deletedOn?: Date | null;

  /* UUID user id — same shape as the parent entity. */
  @Column({ type: 'text', name: 'deleted_by', nullable: true })
  deletedBy?: string | null;
}
