import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ThresholdProfile } from './threshold-profile.entity';

/**
 * Individual condition row under a `threshold_profile`. Each row is one
 * (metric, operator, value) tuple — e.g. `(PRR, >=, 2.0)`. A profile is
 * just the set of its conditions.
 *
 * `ON DELETE CASCADE` on the FK so deleting a profile removes its
 * conditions automatically.
 */
@Entity('threshold_condition')
@Index('ix_tc_profile', ['thresholdProfileId'])
export class ThresholdCondition extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'integer', name: 'threshold_condition_id' })
  thresholdConditionId: number;

  @Column({ type: 'integer', name: 'threshold_profile_id' })
  thresholdProfileId: number;

  @ManyToOne(() => ThresholdProfile, p => p.conditions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'threshold_profile_id' })
  thresholdProfile: ThresholdProfile;

  @Column({ type: 'text' })
  metric: string;

  // `operator` is a reserved word in SQL; the column is quoted in the
  // DDL. TypeORM emits it correctly when the JS field name matches.
  @Column({ type: 'text', name: 'operator' })
  operator: string;

  @Column({ type: 'double precision' })
  value: number;

  @Column({ type: 'boolean', name: 'is_enabled', default: true })
  isEnabled: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'tgt_insert_date_time' })
  tgtInsertDateTime: Date;
}
