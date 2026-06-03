import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { Dataset } from './dataset.entity';
import { DatasetField } from './datasetField.entity';
import { DatasourceS } from './datasourceS.entity';
import { Visual } from './visual.entity';

@Entity()
@Index(['clientId', 'datasourceId'])
@Index(['datasetId'])
@Index(['lineageId'])
// Race-safety for concurrent edits on the same lineage. Two
// updateAnalysis calls racing against A1 each compute their next
// versionNumber from `MAX(...) + 1`; without this unique index
// they would both insert v2 and silently corrupt the lineage. With
// the index, the second insert raises a unique-violation, the
// caller catches + retries with a fresh max. See
// cloneAnalysisVersion.helper.ts for the retry path.
@Index(['lineageId', 'versionNumber'], { unique: true })
export class Analyses {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ─── Logical-version lineage ───────────────────────────────────────
  //
  // An "analysis" the user sees in the UI is really a *chain* of
  // Analyses rows. Every save spawns a fresh row (the next version)
  // and the previous row becomes immutable history. Two columns wire
  // the chain together:
  //
  //   lineageId  — stable id shared by every version of the same
  //                logical analysis. For the FIRST row of a chain
  //                this equals `id`; clones copy the original's
  //                lineageId so all versions are reachable with a
  //                single `where: { lineageId }` query.
  //
  //   versionNumber — monotonically increasing per lineage. 1, 2, 3…
  //                Used for ordering + displaying "v3" to users.
  //                Distinct from the TypeORM `@VersionColumn`
  //                (`version`) below, which is the optimistic-lock
  //                row counter and is irrelevant once edits stop
  //                mutating in place.
  //
  // Dashboards pin to a specific Analyses.id (via sourceAnalysisId)
  // so D1 always sees the exact A1 it was published from, even after
  // A2/A3 are spawned. listAnalyses returns only the head of each
  // lineage by default; an explicit endpoint surfaces history.
  @Column({ nullable: true })
  lineageId: string;

  @Column({ type: 'int', nullable: false, default: 1 })
  versionNumber: number;

  @Column({ nullable: false })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: false })
  datasetId: string;

  @ManyToOne(() => Dataset, dataset => dataset.analyses)
  @JoinColumn({ name: 'datasetId' })
  dataset: Dataset;

  @OneToMany(() => Visual, visual => visual.analysis)
  visuals: Visual[];

  @OneToMany(() => DatasetField, field => field.analysis)
  analysisFields: DatasetField[];

  @Column({ nullable: false })
  clientId: string;

  @Column({ nullable: false })
  clientName: string;

  @Column({ nullable: false })
  datasourceId: string;

  @ManyToOne(() => DatasourceS, { nullable: false })
  @JoinColumn({ name: 'datasourceId' })
  datasource: DatasourceS;

  @Column({
    type: 'enum',
    enum: [0, 1],
    default: 1,
  })
  status!: number;

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
