import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Group } from './group.entity';

@Entity()
@Index(['organisationId', 'targetGroupId', 'status'])
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  name: string;

  @Column({ nullable: false })
  description: string;

  @Column({ nullable: false })
  organisationId: string;

  @Column({ nullable: false })
  organisationName: string;

  // Group this announcement is targeted to. Users in this group will see it.
  @Column({ nullable: false })
  targetGroupId: string;

  // RESTRICT prevents group deletion while announcements reference it.
  // Name is always read fresh via this relation — no denormalized snapshot.
  @ManyToOne(() => Group, {
    nullable: false,
    onDelete: 'RESTRICT',
    eager: false,
  })
  @JoinColumn({ name: 'targetGroupId' })
  targetGroup: Group;

  // 0 = inactive, 1 = active
  @Column({ type: 'int', nullable: false, default: 1 })
  status: number;

  @Column({ type: 'timestamptz', nullable: true })
  startTime?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endTime?: Date;

  @Column({ nullable: false, default: '#0d47a1' })
  bgColor: string;

  @Column({ nullable: false, default: '#ffffff' })
  textColor: string;

  @CreateDateColumn({ nullable: true })
  createdOn?: Date;

  @Column({ nullable: true, select: false })
  createdBy?: string;

  @UpdateDateColumn({ nullable: true })
  updatedOn?: Date;

  @Column({ nullable: true, select: false })
  updatedBy?: string;
}
