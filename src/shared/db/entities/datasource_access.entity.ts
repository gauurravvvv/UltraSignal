import {
  BaseEntity,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DatasourceConnection } from './connections.entity';
import { Group } from './group.entity';
import { User } from './user.entity';

@Entity()
@Index(['organisationId', 'datasourceId'])
@Index(['userId'])
@Index(['groupId'])
@Index(['connectionId'])
export class DatasourceAccess extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  connectionId: string;

  @Column({ nullable: false })
  organisationId: string;

  @Column({ nullable: false })
  organisationName: string;

  @Column({ nullable: false })
  datasourceId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'varchar', nullable: true })
  userId: string | null;

  @ManyToOne(() => Group, { nullable: true })
  @JoinColumn({ name: 'groupId' })
  group?: Group;

  @Column({ type: 'varchar', nullable: true })
  groupId: string | null;

  @ManyToOne(() => DatasourceConnection, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'connectionId' })
  connection: DatasourceConnection;
}
