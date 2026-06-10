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

/**
 * Permission catalog (modules + screens), self-referenced.
 *
 *   parent_id IS NULL  → top-level MODULE (sidebar section)
 *   parent_id set      → SCREEN under that module
 *
 * Only screens (children) get attached to roles via
 * `role_permission_mapping`. Modules are organisational headers — they
 * don't carry levels themselves.
 *
 * `value` is the immutable code identifier used by the middleware
 * (`VerifyPermissionMiddleware('users', ACCESS.READ)`); `name` is the
 * human-readable label shown in the sidebar / role editor.
 *
 * `scope` ('SYSTEM' | 'ORG') keeps platform-only permissions
 * (e.g. clientManagement) out of the per-client role editor.
 */
@Entity()
@Index(['parentId'])
@Index(['scope', 'status'])
export class Permission extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  value: string;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @ManyToOne(() => Permission, p => p.children, { nullable: true })
  @JoinColumn({ name: 'parentId' })
  parent: Permission | null;

  @OneToMany(() => Permission, p => p.parent)
  children: Permission[];

  @Column({ type: 'varchar', length: 64, nullable: true })
  icon: string | null;

  @Column({ type: 'smallint', default: 0 })
  sequence: number;

  @Column({
    type: 'enum',
    enum: ['SYSTEM', 'ORG'],
    default: 'ORG',
  })
  scope: 'SYSTEM' | 'ORG';

  @Column({
    type: 'enum',
    enum: [0, 1],
    default: 1,
  })
  status: number;

  // Mandatory permissions are granted to every authenticated user
  // implicitly — no row in `role_permission_mapping` is needed.
  // resolveUserPermissions UNIONs them onto every user's effective set
  // at read time. Used for things like the Home landing page that must
  // be available to everyone regardless of role.
  @Column({ type: 'boolean', default: false })
  isMandatory: boolean;

  @CreateDateColumn({ nullable: true })
  createdOn?: Date;

  @Column({ nullable: true })
  createdBy?: string;

  @UpdateDateColumn({ nullable: true, select: false })
  updatedOn?: Date;

  @Column({ nullable: true, select: false })
  updatedBy?: string;
}
