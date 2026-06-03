import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
@Index(['userId', 'announcementId'], { unique: true })
@Index(['userId'])
export class AnnouncementDismissal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  userId: string;

  @Column({ nullable: false })
  announcementId: string;

  @CreateDateColumn({ nullable: true })
  dismissedOn?: Date;
}
