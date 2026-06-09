import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Permission } from './permission.entity';
import { Role } from './role.entity';

/**
 * Role × Permission grant.
 *
 *   level = 1 → READ
 *   level = 2 → WRITE
 *   level = 3 → FULL
 *
 * Absence of a row for a (role, permission) pair means NONE — the role
 * grants nothing on that permission. We never store level = 0 explicitly.
 *
 * Login resolves a user's effective level on a permission by taking
 * MAX(level) across all rows where role_id is in the user's groups'
 * roles.
 *
 * The UNIQUE (role_id, permission_id) constraint means a role can hold
 * at most one level on any given permission — to change a level, UPDATE
 * the existing row rather than inserting a duplicate.
 */
@Entity('role_permission_mapping')
@Index(['roleId'])
@Index(['permissionId'])
@Index(['roleId', 'permissionId'], { unique: true })
export class RolePermissionMapping extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  roleId: string;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @Column({ type: 'uuid' })
  permissionId: string;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permissionId' })
  permission: Permission;

  @Column({ type: 'smallint' })
  level: number;

  @CreateDateColumn({ nullable: true })
  createdOn?: Date;

  @Column({ nullable: true })
  createdBy?: string;

  @UpdateDateColumn({ nullable: true, select: false })
  updatedOn?: Date;

  @Column({ nullable: true, select: false })
  updatedBy?: string;
}
