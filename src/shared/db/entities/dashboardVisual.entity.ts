import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Dashboard } from './dashboard.entity';
import { DashboardVisualConfig } from './dashboardVisualConfig.entity';

/**
 * Per-dashboard snapshot of a Visual.
 *
 * Mirrors the shape of `Visual` so the dashboard's render endpoint
 * can emit the same response structure the FE already consumes —
 * the goal of the snapshot model is to be transparent to the
 * dashboard view code, NOT to introduce a new client-side shape.
 *
 * Owned by Dashboard. ON DELETE CASCADE so deleting a dashboard
 * tears down all its snapshot children in one shot.
 */
@Entity()
@Index(['dashboardId'])
@Index(['clientId', 'datasourceId'])
export class DashboardVisual {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  dashboardId: string;

  @ManyToOne(() => Dashboard, d => d.visuals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dashboardId' })
  dashboard: Dashboard;

  @Column({ nullable: false })
  title: string;

  @Column({ nullable: false, default: '0' })
  widthRatio: string;

  @Column({ nullable: false, default: '0' })
  heightRatio: string;

  @Column({ nullable: false, default: '0' })
  xRatio: string;

  @Column({ nullable: false, default: '0' })
  yRatio: string;

  @Column({ nullable: false, default: 0 })
  sequence: number;

  @Column({ nullable: false })
  clientId: string;

  @Column({ nullable: false })
  clientName: string;

  @Column({ nullable: false })
  datasourceId: string;

  @Column({ nullable: false })
  datasetId: string;

  // Audit pointer to the original Visual row that seeded this snapshot.
  // No FK — the source visual can be deleted without affecting us.
  @Column({ nullable: true })
  sourceVisualId: string;

  @OneToOne(() => DashboardVisualConfig, vc => vc.dashboardVisual)
  visualConfig: DashboardVisualConfig;
}
