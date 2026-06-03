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
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { DatasourceS } from './datasourceS.entity';
import { Prompt } from './prompt.entity';
import { Tab } from './tab.entity';

@Entity()
@Index(['tabId'])
@Index(['organisationId', 'datasourceId'])
export class Section {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: false })
  tabId: string;

  @ManyToOne(() => Tab, { nullable: false })
  @JoinColumn({ name: 'tabId' })
  tab: Tab;

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

  @OneToMany(() => Prompt, prompt => prompt.section)
  prompts: Prompt[];

  @Column({ nullable: true })
  sectionControlName: string;

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

    this.sectionControlName = `${camelCaseName}SectionControl`;
  }
}
