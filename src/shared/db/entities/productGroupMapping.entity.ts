import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProductBrowser } from './products.entity';
import { ProductGroup } from './productGroup.entity';

/**
 * Many-to-many join between ProductGroup and ProductBrowser. Carries
 * the per-member metadata needed by the Product Browser UI (language,
 * level — ingredient vs product vs trade name).
 *
 * Soft-deletable so a removed member can be restored if the group is
 * accidentally edited.
 */
@Entity()
@Index(['productGroupId'])
@Index(['memberId'])
@Index(['productGroupId', 'memberId'], { unique: true })
export class ProductGroupMapping extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  productGroupId: string;

  @Column({ nullable: false })
  memberId: string;

  @ManyToOne(() => ProductGroup, group => group.members, { nullable: false })
  @JoinColumn({ name: 'productGroupId' })
  productGroup: ProductGroup;

  @ManyToOne(() => ProductBrowser, { nullable: false })
  @JoinColumn({ name: 'memberId' })
  member: ProductBrowser;

  @Column({ nullable: false })
  clientId: string;

  @Column({ type: 'int', nullable: true })
  sourceId: number;

  @Column({ type: 'varchar', length: 10, default: 'en' })
  language: string;

  // ingredient | product | trade — which level of the product
  // hierarchy this member was picked at. Drives how the browser
  // expands membership when an alert runs.
  @Column({ type: 'varchar', nullable: true })
  level: string;

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
