import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EventGroup } from './eventGroup.entity';
import { MeddraBrowser } from './meddra.entity';

/**
 * Many-to-many join between EventGroup and MeddraBrowser. `level`
 * captures which MedDRA tier the member was selected at (SOC, HLGT,
 * HLT, PT, LLT, or SMQ) — at runtime the alert engine expands the
 * member down to PT/LLT for case matching.
 */
@Entity()
@Index(['eventGroupId'])
@Index(['memberId'])
@Index(['eventGroupId', 'memberId'], { unique: true })
export class EventGroupMapping extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  eventGroupId: string;

  @Column({ nullable: false })
  memberId: string;

  @ManyToOne(() => EventGroup, group => group.members, { nullable: false })
  @JoinColumn({ name: 'eventGroupId' })
  eventGroup: EventGroup;

  @ManyToOne(() => MeddraBrowser, { nullable: false })
  @JoinColumn({ name: 'memberId' })
  member: MeddraBrowser;

  @Column({ nullable: false })
  clientId: string;

  @Column({ type: 'int', nullable: true })
  sourceId: number;

  @Column({ type: 'varchar', length: 10, default: 'en' })
  language: string;

  // SOC | HLGT | HLT | PT | LLT | SMQ
  @Column({ type: 'varchar', nullable: true })
  level: string;

  @CreateDateColumn({ nullable: true })
  createdOn?: Date;

  @Column({ nullable: true })
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
