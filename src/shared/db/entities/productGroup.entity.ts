import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { ProductGroupMapping } from './productGroupMapping.entity';

/**
 * Product Group — a tenant-scoped, user-curated bundle of products
 * selected from the Product Browser. Reused across Alert Configs so
 * analysts don't re-select the same product set for every alert.
 *
 * "Only relevant users should have access to update an existing group"
 * (per requirements): editing is gated by record-level ownership
 * (`createdBy`) at the controller layer, not by a separate permission
 * value. See the Reviewer separation-of-duties model.
 */
@Entity()
@Index(['clientId', 'status'])
@Index(['name', 'clientId'], { unique: true })
export class ProductGroup extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: false })
  clientId: string;

  @Column({ nullable: false })
  clientName: string;

  // Which external source this group filters by (AEMS/EVDAS/VigiBase/UAN).
  // Null means the group is source-agnostic and unions members across
  // all sources.
  @Column({ type: 'int', nullable: true })
  sourceId: number;

  @OneToMany(() => ProductGroupMapping, mapping => mapping.productGroup)
  members: ProductGroupMapping[];

  @Column({
    type: 'enum',
    enum: [0, 1],
    default: 1,
  })
  status!: number;

  @Column({
    type: 'enum',
    enum: [0, 1],
    default: 0,
  })
  isDefault!: number;

  @VersionColumn({ select: false })
  version: number;

  @CreateDateColumn({ nullable: true })
  createdOn?: Date;

  @Column({ nullable: true })
  createdBy?: string;

  @UpdateDateColumn({ nullable: true, select: false })
  updatedOn?: Date;

  @Column({ nullable: true, select: false })
  updatedBy?: string;

  @DeleteDateColumn({ nullable: true, select: false })
  deletedOn?: Date;

  @Column({ nullable: true, select: false })
  deletedBy?: string;
}
