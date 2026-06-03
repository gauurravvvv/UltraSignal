import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Dashboard } from './dashboard.entity';
import { DashboardField } from './dashboardField.entity';

/**
 * Per-dashboard snapshot of a DatasetFieldRelation.
 *
 * Custom field A whose formula references field B has a relation row
 * (fieldId=A, referencedFieldId=B). Used by the BE enrichment helper
 * to topologically sort fields so dependent values are computed in
 * the right order.
 *
 * IDs here point at DashboardField rows (the snapshot copies), NOT
 * the original DatasetField rows. The snapshot helper remaps them
 * at publish time.
 */
@Entity()
@Index(['dashboardId'])
@Index(['fieldId'])
@Index(['referencedFieldId'])
export class DashboardFieldRelation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  dashboardId: string;

  @ManyToOne(() => Dashboard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dashboardId' })
  dashboard: Dashboard;

  @Column({ nullable: false })
  fieldId: string;

  @ManyToOne(() => DashboardField, f => f.fieldRelations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'fieldId' })
  field: DashboardField;

  @Column({ nullable: false })
  referencedFieldId: string;

  @ManyToOne(() => DashboardField, f => f.referencedInRelations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'referencedFieldId' })
  referencedField: DashboardField;
}
