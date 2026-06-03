import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Analyses } from './analyses.entity';
import { Dataset } from './dataset.entity';
import { DatasetFieldRelation } from './datasetFieldRelation.entity';

@Entity()
@Index(['datasetId'])
@Index(['analysisId'])
@Index(['organisationId', 'datasourceId'])
export class DatasetField {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  columnToUse: string;

  @Column({ nullable: false })
  columnToView: string;

  @Column({ type: 'varchar', nullable: true })
  customLogic: string | null;

  @Column({
    type: 'enum',
    enum: [0, 1], //0: Yes, 1: No
    default: 0,
  })
  isCfUsed: number;

  @Column({
    type: 'enum',
    enum: [1, 2], //1: default, 2: custom
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

  @Column({ nullable: true })
  analysisId: string;

  @ManyToOne(() => Dataset, dataset => dataset.datasetFields)
  @JoinColumn({ name: 'datasetId' })
  dataset: Dataset;

  @ManyToOne(() => Analyses, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'analysisId' })
  analysis: Analyses;

  @OneToMany(() => DatasetFieldRelation, relation => relation.field)
  fieldRelations: DatasetFieldRelation[];

  @OneToMany(() => DatasetFieldRelation, relation => relation.referencedField)
  referencedInRelations: DatasetFieldRelation[];
}
