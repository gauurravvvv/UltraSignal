import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Scope } from './scope.entity';

/**
 * Per-client (or system-default) bundle of statistical constants used by
 * disproportionality / Bayesian shrinkage analyses (PRR/ROR, IC, EBGM).
 *
 *   z95, z90       — Z-scores for 95% / 90% confidence intervals
 *   haldane        — Haldane's continuity correction value
 *   ic_k           — Information Component prior shrinkage `k`
 *   ebgm_w         — EBGM mixture weight (between Gamma components)
 *   ebgm_a1/b1/a2/b2 — Hyperparameters for the two Gamma mixture
 *                     components of the EBGM prior
 *
 * Like `threshold_profile`:
 *   client_id = NULL  → system default
 *   client_id = <id>  → tenant override
 *
 * The "at most one default per (client, scope)" rule from the DDL is not
 * enforced by the entity decorators — add it via raw SQL if you want it
 * at the DB layer.
 */
@Entity('statistical_constants_profile')
export class StatisticalConstantsProfile extends BaseEntity {
  @PrimaryGeneratedColumn({
    type: 'integer',
    name: 'statistical_constants_profile_id',
  })
  statisticalConstantsProfileId: number;

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

  @Column({ type: 'double precision' })
  z95: number;

  @Column({ type: 'double precision' })
  z90: number;

  @Column({ type: 'double precision' })
  haldane: number;

  @Column({ type: 'double precision', name: 'ic_k' })
  icK: number;

  @Column({ type: 'double precision', name: 'ebgm_w' })
  ebgmW: number;

  @Column({ type: 'double precision', name: 'ebgm_a1' })
  ebgmA1: number;

  @Column({ type: 'double precision', name: 'ebgm_b1' })
  ebgmB1: number;

  @Column({ type: 'double precision', name: 'ebgm_a2' })
  ebgmA2: number;

  @Column({ type: 'double precision', name: 'ebgm_b2' })
  ebgmB2: number;

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
}
