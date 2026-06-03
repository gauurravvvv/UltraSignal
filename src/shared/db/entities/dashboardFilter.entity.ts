import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Dashboard } from './dashboard.entity';

/**
 * Per-dashboard snapshot of an AnalysisFilter.
 *
 * Mirrors `AnalysisFilter` field-for-field. config.defaultValue is
 * snapshotted along with the filter definition, so viewers open the
 * dashboard with the exact same defaults the publisher had in the
 * source analysis at publish time.
 *
 * Viewer-side selections are NOT persisted — they stay session-local.
 * If we ever want "remember my selection" we'd add a separate
 * dashboard_user_state table; this entity is the immutable snapshot.
 */
@Entity()
@Index(['dashboardId'])
@Index(['organisationId', 'datasourceId'])
export class DashboardFilter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  dashboardId: string;

  @ManyToOne(() => Dashboard, d => d.filters, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dashboardId' })
  dashboard: Dashboard;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  filterType: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  columnName: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  controlType: string;

  @Column({ type: 'jsonb', nullable: true })
  config: any;

  @Column({ type: 'varchar', length: 20, default: 'ALL_VALUES' })
  nullOption: string;

  @Column({ default: true })
  isEnabled: boolean;

  @Column({ default: false })
  isMandatory: boolean;

  @Column({ default: 0 })
  sequence: number;

  @Column({ nullable: false })
  organisationId: string;

  @Column({ nullable: false })
  organisationName: string;

  @Column({ nullable: false })
  datasourceId: string;

  @Column({ nullable: false })
  datasetId: string;

  // Audit pointer to the original AnalysisFilter row.
  @Column({ nullable: true })
  sourceFilterId: string;

  @CreateDateColumn({ nullable: true })
  createdOn?: Date;
}
