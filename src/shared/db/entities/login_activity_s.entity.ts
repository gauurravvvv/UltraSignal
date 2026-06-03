import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('login_activity')
@Index(['userId'])
@Index(['clientId', 'eventType'])
@Index(['createdOn'])
@Index(['eventType'])
export class LoginActivityS extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  userId: string | null;

  @Column({ nullable: false })
  username: string;

  @Column({ type: 'varchar', nullable: true })
  clientId: string | null;

  @Column({ type: 'varchar', nullable: true })
  clientName: string | null;

  @Column({ nullable: false })
  eventType: string;

  @Column({ type: 'varchar', nullable: true })
  failureReason: string | null;

  @Column({ type: 'varchar', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', nullable: true })
  sessionId: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: any;

  @CreateDateColumn()
  createdOn: Date;
}
