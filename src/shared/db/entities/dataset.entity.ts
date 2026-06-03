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
import { Analyses } from './analyses.entity';
import { DatasetField } from './datasetField.entity';
import { DatasourceS } from './datasourceS.entity';

@Entity()
@Index(['clientId', 'datasourceId'])
@Index(['datasourceId', 'status'])
export class Dataset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: false })
  sql: string;

  @Column({
    type: 'enum',
    enum: [1, 2], //1: SQL Dataset, 2: Prompt
    default: 1,
  })
  type: number;

  @Column({ nullable: true })
  queryBuilderId: string;

  @Column({ type: 'text', nullable: true })
  promptConfig: string;

  @Column({ nullable: false })
  clientId: string;

  @Column({ nullable: false })
  clientName: string;

  @Column({ nullable: false })
  datasourceId: string;

  @ManyToOne(() => DatasourceS, { nullable: false })
  @JoinColumn({ name: 'datasourceId' })
  datasource: DatasourceS;

  @OneToMany(() => Analyses, analysis => analysis.dataset)
  analyses: Analyses[];

  @OneToMany(() => DatasetField, datasetField => datasetField.dataset)
  datasetFields: DatasetField[];

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
