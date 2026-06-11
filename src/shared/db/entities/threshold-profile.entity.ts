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
} from 'typeorm';
import { Scope } from './scope.entity';
import { ThresholdCondition } from './threshold-condition.entity';

/**
 * Per-client (or system-default) threshold profile — a named bundle of
 * threshold conditions used by signal detection.
 *
 *   client_id = NULL   → system default available to every client
 *   client_id = <id>   → tenant-specific profile (only that client sees it)
 *
 * One row per (client_id, scope_id, code). `is_default` marks the
 * profile picked when no explicit choice is made — at most one default
 * per (client_id, scope_id), enforced at the application layer (the
 * functional unique index from the original DDL is not added here; if
 * you want it enforced at the DB layer, add a partial unique index via
 * raw SQL: `CREATE UNIQUE INDEX ux_tp_default ON threshold_profile
 * (COALESCE(client_id, 0::bigint), scope_id) WHERE is_default = true;`).
 *
 * `client_id` holds the owning tenant's `client_code` (varchar(4),
 * e.g. 'UG', 'KK01'). NULL means "system default — visible to every
 * tenant". The column isn't an FK; it stores the stable 4-char code
 * directly so the rest of the codebase can match tenant rows by code
 * without joining back through the UUID-keyed `client` table.
 */
@Entity('threshold_profile')
@Index('ix_tp_scope_client', ['scopeId', 'clientId'])
export class ThresholdProfile extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'integer', name: 'threshold_profile_id' })
  thresholdProfileId: number;

  @Column({ type: 'text' })
  code: string;

  @Column({ type: 'text', name: 'display_name' })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'smallint', name: 'scope_id' })
  scopeId: number;

  @ManyToOne(() => Scope, { eager: false })
  @JoinColumn({ name: 'scope_id' })
  scope: Scope;

  // Stores the owning client's 4-char `clientCode` (e.g. 'UG'). NULL =
  // system default (visible to every tenant).
  @Column({ type: 'varchar', length: 4, name: 'client_id', nullable: true })
  clientId?: string | null;

  @Column({ type: 'boolean', name: 'is_default', default: false })
  isDefault: boolean;

  @Column({ type: 'boolean', name: 'is_enabled', default: true })
  isEnabled: boolean;

  @Column({ type: 'bigint', name: 'created_by', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdOn: Date;

  @Column({ type: 'bigint', name: 'updated_by', nullable: true })
  updatedBy?: string | null;

  @Column({ type: 'timestamptz', name: 'updated_at', nullable: true })
  updatedOn?: Date;

  @OneToMany(() => ThresholdCondition, c => c.thresholdProfile)
  conditions: ThresholdCondition[];
}
