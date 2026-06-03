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
import { Prompt } from './prompt.entity';
import { QueryBuilder } from './queryBuilder.entity';
import { Section } from './section.entity';
import { Tab } from './tab.entity';

@Entity()
@Index(['queryBuilderId'])
@Index(['clientId', 'datasourceId'])
export class QueryBuilderPrompts {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  queryBuilderId: string;

  @ManyToOne(() => QueryBuilder, { nullable: false })
  @JoinColumn({ name: 'queryBuilderId' })
  queryBuilder: QueryBuilder;

  @Column({ nullable: false })
  promptId: string;

  @ManyToOne(() => Prompt, { nullable: false })
  @JoinColumn({ name: 'promptId' })
  prompt: Prompt;

  @Column({ nullable: false })
  tabId: string;

  @ManyToOne(() => Tab, { nullable: false })
  @JoinColumn({ name: 'tabId' })
  tab: Tab;

  @Column({ nullable: false })
  sectionId: string;

  @ManyToOne(() => Section, { nullable: false })
  @JoinColumn({ name: 'sectionId' })
  section: Section;

  @Column({ nullable: false })
  clientId: string;

  @Column({ nullable: false })
  clientName: string;

  @Column({ nullable: false })
  datasourceId: string;

  @Column({ nullable: false, default: 0 })
  tabSequence: number;

  @Column({ nullable: false, default: 0 })
  sectionSequence: number;

  @Column({ nullable: false, default: 0 })
  promptSequence: number;

  @Column({ nullable: false, default: false })
  isGrouped: boolean;

  @Column({ nullable: false, default: false })
  isMandatory: boolean;

  @Column({ nullable: false, default: 0 })
  groupId: string;

  @Column({ nullable: true })
  color: string;

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
