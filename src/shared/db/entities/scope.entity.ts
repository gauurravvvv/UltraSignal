import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Catalog of analysis scopes (Spontaneous, Clinical, Combined, ...).
 * System-wide reference data used by both `threshold_profile` and
 * `statistical_constants_profile` to scope a profile to one analytical
 * context.
 */
@Entity('scope')
export class Scope extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'smallint', name: 'scope_id' })
  scopeId: number;

  @Column({ type: 'text', unique: true })
  code: string;

  @Column({ type: 'text', name: 'display_name' })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'tgt_insert_date_time' })
  tgtInsertDateTime?: Date;
}
