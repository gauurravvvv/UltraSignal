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
import { RolePermissionMapping } from './role-permission-mapping.entity';

@Entity()
@Index(['clientId', 'status'])
@Index(['name', 'clientId'], { unique: true })
export class Role extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  name: string;

  /**
   * Permission grants live in `role_permission_mapping` — one row per
   * (role, permission) carrying a level (1=Read, 2=Write, 3=Full). The
   * legacy `permissions: text` JSON column has been removed.
   */
  @OneToMany(() => RolePermissionMapping, m => m.role)
  permissionMappings: RolePermissionMapping[];

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  clientId: string;

  @Column({ nullable: true })
  clientName: string;

  /**
   * Scope of this role. SYSTEM = platform-level role (seeded System
   * Admin); ORG = per-client role. SYSTEM rows still carry
   * a clientId pointing at the seed System Client so
   * that client-scoped queries (filtered by clientId) stay
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
