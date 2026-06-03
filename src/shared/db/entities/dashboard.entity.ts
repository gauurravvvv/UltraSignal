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
import { DashboardField } from './dashboardField.entity';
import { DashboardFilter } from './dashboardFilter.entity';
import { DashboardVisual } from './dashboardVisual.entity';

/**
 * Dashboard entity — snapshot model.
 *
 * A dashboard is a point-in-time, fully self-contained snapshot of an
 * analysis at publish time. After publish, editing the source analysis
 * NEVER mutates this dashboard. To capture a newer state of the
 * analysis, the user publishes again — either as a brand-new dashboard
 * (publish mode = 'new') or overwriting an existing one (mode =
 * 'existing', destructive, requires confirmation in the UI).
 *
 * What's snapshotted:
 *   - dataset_sql + dataset_name (so we don't read Dataset live)
 *   - dashboard_visual + dashboard_visual_config rows
 *   - dashboard_field rows (all dataset-level + analysis-level fields
 *     the analysis had access to at publish time)
 *   - dashboard_filter rows
 *
 * What's NOT stored on this entity itself, just denormalised pointers
 * for audit:
 *   - sourceAnalysisId: which analysis seeded this dashboard. No FK
 *     constraint — a deleted source analysis must not cascade-delete
 *     the published dashboard.
 *
 * Read paths:
 *   - GET /dashboard/render/:orgId/:id   reads ONLY from the snapshot
 *     tables. Never touches Analyses, Visual, DatasetField, or
 *     AnalysisFilter.
 *   - POST /dashboard/run                runs dataset_sql + enriches
 *     with snapshotted custom-field formulas.
 *   - POST /dashboard/distinct-values    same isolation rule.
 *
 * Dev-phase note: when this entity ships, the old live-view dashboard
 * rows in dev databases are wiped — the schema change is breaking and
 * there's no migration. Pre-prod only; document for the team.
 */
@Entity()
@Index(['organisationId', 'datasourceId'])
@Index(['sourceAnalysisId'])
// Unique (org, name) — enforced at the DB level so two concurrent
// publishes with the same name can't both succeed. The validation
// middleware does an early friendly-error check, but Postgres is
// the actual source of truth.
@Index(['organisationId', 'name'], { unique: true })
export class Dashboard extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // Soft pointer to the analysis this dashboard was published from.
  // No FK constraint — deleting the source analysis must not cascade
  // to its published dashboards.
  @Column({ nullable: true })
  sourceAnalysisId: string;

  // `datasetId` is denormalised on the dashboard so render-time
  // joins can scope by dataset (RLS, field lookups) without first
  // resolving sourceAnalysis → analysis.datasetId every time.
  @Column({ nullable: false })
  datasetId: string;

  // `datasetSql` and `datasetName` were originally pinned at publish
  // time (snapshot model). The product moved to a live model: the
  // dashboard render path follows
  //   dashboard.sourceAnalysisId → Analyses → Dataset
  // and reads `dataset.sql` / `dataset.name` live on every request,
  // so an edit to the source dataset propagates to all dashboards
  // built on it without republishing.
  //
  // These columns are kept nullable on the entity for backwards-compat
  // with rows written under the old snapshot model. New publishes
  // write empty strings (`''`) — NOT null — because the production DB
  // schema may still enforce NOT NULL until the explicit
  // `ALTER COLUMN ... DROP NOT NULL` migration runs. The empty-string
  // write satisfies the constraint on un-migrated DBs and behaves
  // identically to null for every consumer (no production code reads
  // these columns). After the column-nullability migration ships,
  // publishDashboard can switch to writing null and the empty-string
  // workaround can be deleted

  @Column({ nullable: false })
  datasourceId: string;

  @Column({ nullable: false })
  organisationId: string;

  @Column({ nullable: false })
  organisationName: string;

  @Column({ type: 'enum', enum: [0, 1], default: 1 })
  status!: number;

  // Publish-time audit. publishedAt is the moment the snapshot was
  // taken; publishedBy is the user who clicked Publish. snapshotVersion
  // increments every time the dashboard is republished-as-existing so
  // we have a monotonically-increasing trail for debugging.
  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date;

  @Column({ nullable: true })
  publishedBy: string;

  @Column({ nullable: false, default: 1 })
  snapshotVersion: number;

  // ── Relations (snapshot children) ──

  @OneToMany(() => DashboardVisual, v => v.dashboard, { cascade: false })
  visuals: DashboardVisual[];

  @OneToMany(() => DashboardFilter, f => f.dashboard, { cascade: false })
  filters: DashboardFilter[];

  @OneToMany(() => DashboardField, f => f.dashboard, { cascade: false })
  fields: DashboardField[];

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
