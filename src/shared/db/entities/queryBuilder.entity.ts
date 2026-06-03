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
import { DatasourceS } from './datasourceS.entity';
import { QueryBuilderPrompts } from './queryBuilderPrompts.entity';

@Entity()
@Index(['organisationId', 'datasourceId'])
export class QueryBuilder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: false })
  organisationId: string;

  @Column({ nullable: false })
  organisationName: string;

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

  @OneToMany(
    () => QueryBuilderPrompts,
    queryBuilderPrompt => queryBuilderPrompt.queryBuilder,
  )
  queryBuilderPrompts: QueryBuilderPrompts[];

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
