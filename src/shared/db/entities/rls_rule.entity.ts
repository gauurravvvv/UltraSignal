import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { Dataset } from './dataset.entity';

@Entity()
@Index(['datasetId'])
@Index(['organisationId', 'datasetId'])
@Index(['scope', 'scopeId'])
export class RlsRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: false })
  datasetId: string;

  @ManyToOne(() => Dataset, { nullable: false })
  @JoinColumn({ name: 'datasetId' })
  dataset: Dataset;

  // 'user' or 'group'
  @Column({ type: 'varchar', length: 20, nullable: false })
  scope: string;

  // The userId or groupId this rule applies to (polymorphic — no FK constraint)
  @Column({ nullable: false })
  scopeId: string;

  // Column in the dataset to filter on
  @Column({ type: 'varchar', length: 255, nullable: false })
  columnName: string;

  // Filter operator: IN, NOT_IN, EQUALS, BETWEEN
  @Column({ type: 'varchar', length: 30, nullable: false, default: 'IN' })
  operator: string;

  // The allowed/restricted values (stored as JSONB array)
  @Column({ type: 'jsonb', nullable: false, default: '[]' })
  values: any[];

  @Column({ default: true })
  isEnabled: boolean;

  // Denormalized fields
  @Column({ nullable: false })
  organisationId: string;

  @Column({ nullable: false })
  organisationName: string;

  @Column({ nullable: false })
  datasourceId: string;

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
