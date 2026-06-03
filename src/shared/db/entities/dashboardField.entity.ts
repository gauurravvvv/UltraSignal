import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Dashboard } from './dashboard.entity';
import { DashboardFieldRelation } from './dashboardFieldRelation.entity';

/**
 * Per-dashboard snapshot of a DatasetField. Holds BOTH:
 *
 *   - Native dataset columns the analysis exposed at publish time
 *     (type=1, customLogic=null). These are stored so that even if
 *     the dataset SQL is edited later and a column dropped, the
 *     dashboard knows the column existed at publish time and can
 *     surface a missing-field warning instead of just rendering
 *     blank.
 *
 *   - Dataset-level custom fields (type=2, analysis-id-was-null on
 *     the original DatasetField). Snapshot of the formula and
 *     dependency graph at publish time.
 *
 *   - Analysis-level custom fields (type=2, analysis-id was set).
 *     Same treatment.
 *
 * Mirrors `DatasetField` field-for-field. The dependency graph (which
 * custom field references which other field) is preserved via
 * DashboardFieldRelation with the IDs remapped to point at the new
 * dashboard_field rows.
 */
@Entity()
@Index(['dashboardId'])
@Index(['organisationId', 'datasourceId'])
export class DashboardField {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  dashboardId: string;

  @ManyToOne(() => Dashboard, d => d.fields, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dashboardId' })
  dashboard: Dashboard;

  @Column({ nullable: false })
  columnToUse: string;

  @Column({ nullable: false })
  columnToView: string;

  @Column({ type: 'varchar', nullable: true })
  customLogic: string | null;

  @Column({
    type: 'enum',
    enum: [0, 1], // 0: Yes, 1: No
    default: 0,
  })
  isCfUsed: number;

  @Column({
    type: 'enum',
    enum: [1, 2], // 1: native dataset column, 2: custom field
    default: 1,
  })
  type: number;

  @Column({ nullable: true })
  dataType: string;

  @Column({ nullable: false, default: 0 })
  sequence: number;

  @Column({ nullable: false })
  organisationId: string;

  @Column({ nullable: false })
  organisationName: string;

  @Column({ nullable: false })
  datasourceId: string;

  @Column({ nullable: false })
  datasetId: string;

  // Audit pointer to the original DatasetField. If the source field
  // is later deleted, our snapshot still works (no FK).
  @Column({ nullable: true })
  sourceFieldId: string;

  // Tracks where the original field came from for diagnostics:
  // 'dataset' = analysisId was NULL on the original, 'analysis' = set.
  @Column({ type: 'varchar', length: 20, nullable: true })
  sourceScope: string;

  @OneToMany(() => DashboardFieldRelation, r => r.field)
  fieldRelations: DashboardFieldRelation[];

  @OneToMany(() => DashboardFieldRelation, r => r.referencedField)
  referencedInRelations: DashboardFieldRelation[];
}
