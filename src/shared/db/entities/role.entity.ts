import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

@Entity()
@Index(['organisationId', 'status'])
@Index(['name', 'organisationId'], { unique: true })
export class Role extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  name: string;

  @Column({ type: 'text', nullable: false })
  permissions: string; // JSON stringified permission array

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  organisationId: string;

  @Column({ nullable: true })
  organisationName: string;

  /**
   * Scope of this role. SYSTEM = platform-level role (seeded System
   * Admin); ORG = per-organisation role. SYSTEM rows still carry
   * an organisationId pointing at the seed System Organisation so
   * that org-scoped queries (filtered by organisationId) stay
   * consistent.
   */
  @Column({
    type: 'enum',
    enum: ['SYSTEM', 'ORG'],
    default: 'ORG',
  })
  scope: 'SYSTEM' | 'ORG';

  @Column({
    type: 'enum',
    enum: [0, 1],
    default: 0,
  })
  isDefault: number; // 1 = default role (cannot be edited/deleted)

  @Column({
    type: 'enum',
    enum: [0, 1],
    default: 1,
  })
  status: number;

  @VersionColumn({ select: false })
  version: number;

  @CreateDateColumn({ nullable: true })
  createdOn?: Date;

  @Column({ nullable: true, select: false })
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
