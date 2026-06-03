import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { DatasourceS } from './datasourceS.entity';
import { PromptConfig } from './promptConfig.entity';
import { QueryBuilderPrompts } from './queryBuilderPrompts.entity';
import { Section } from './section.entity';
import { Tab } from './tab.entity';

enum PromptType {
  TEXT = 'text',
  DROPDOWN = 'dropdown',
  MULTISELECT = 'multiselect',
  RADIO = 'radio',
  CALENDAR = 'calendar',
  CHECKBOX = 'checkbox',
  DATE = 'date',
  DATE_RANGE = 'daterange',
  NUMBER = 'number',
  RANGE_SLIDER = 'rangeslider',
}

@Entity()
@Index(['sectionId'])
@Index(['clientId', 'datasourceId'])
export class Prompt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  tabId: string;

  @ManyToOne(() => Tab, { nullable: true })
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

  @ManyToOne(() => DatasourceS, { nullable: false })
  @JoinColumn({ name: 'datasourceId' })
  datasource: DatasourceS;

  @Column({
    type: 'enum',
    enum: [0, 1],
    default: 1,
  })
  status!: number;

  @Column({
    type: 'enum',
    enum: PromptType,
    default: PromptType.TEXT,
  })
  type!: PromptType;

  @Column({ type: 'json', nullable: true })
  validation: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
    [key: string]: any;
  };

  @Column({
    type: 'enum',
    enum: [0, 1],
    default: 0,
  })
  mandatory!: number;

  @Column({ nullable: false, default: false })
  isGroup: boolean;

  @Column({ nullable: true })
  groupId: string;

  @Column({ nullable: true })
  promptControlName: string;

  @Column({ nullable: false, default: 0 })
  sequence: number;

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

  @OneToOne(() => PromptConfig, config => config.prompt)
  config: PromptConfig;

  @OneToMany(
    () => QueryBuilderPrompts,
    queryBuilderPrompt => queryBuilderPrompt.prompt,
  )
  queryBuilderPrompts: QueryBuilderPrompts[];

  @BeforeInsert()
  @BeforeUpdate()
  generateTabControlName() {
    const camelCaseName = this.name
      .split(' ')
      .map((word, index) =>
        index === 0
          ? word.toLowerCase()
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
      )
      .join('');

    this.promptControlName = `${camelCaseName}PromptControl`;
  }
}
