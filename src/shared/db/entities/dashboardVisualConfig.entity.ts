import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DashboardVisual } from './dashboardVisual.entity';

/**
 * Per-dashboard snapshot of a VisualConfig.
 *
 * Mirrors `VisualConfig` 1:1; the dashboard's renderer reads these
 * rows instead of joining through the live Visual / Analyses tables.
 *
 * config is JSONB so chart-config sprawl (40+ tunable properties per
 * chart type) doesn't need a migration every time a new option lands.
 */
@Entity()
@Index(['dashboardVisualId'])
@Index(['dashboardId'])
@Index(['organisationId', 'datasourceId'])
export class DashboardVisualConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  dashboardId: string;

  @Column({ nullable: false })
  dashboardVisualId: string;

  @OneToOne(() => DashboardVisual, dv => dv.visualConfig, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'dashboardVisualId' })
  dashboardVisual: DashboardVisual;

  @Column({ nullable: false })
  chartType: string;

  @Column({ nullable: true })
  xAxisColumn: string;

  @Column({ nullable: true })
  yAxisColumn: string;

  @Column({ type: 'jsonb', nullable: false })
  config: any;

  @Column({ nullable: false })
  organisationId: string;

  @Column({ nullable: false })
  organisationName: string;

  @Column({ nullable: false })
  datasourceId: string;

  @Column({ nullable: false })
  datasetId: string;
}
