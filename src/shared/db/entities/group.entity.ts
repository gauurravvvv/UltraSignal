import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { DatasourceAccess } from './datasource_access.entity';
import { Role } from './role.entity';
import { UserGroupMapping } from './user-group-mapping.entity';
import { User } from './user.entity';

@Entity()
@Index(['organisationId', 'status'])
export class Group extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: false })
  organisationId: string;

  @Column({ nullable: false })
  organisationName: string;

  @Column({ nullable: true })
  roleId?: string;

  @Column({
    type: 'enum',
    enum: [0, 1],
    default: 0,
  })
  isDefault!: number;

  @ManyToOne(() => Role, { nullable: true, eager: false })
  @JoinColumn({ name: 'roleId' })
  role: Role;

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

  @ManyToMany(() => User, user => user.groups)
  users: User[];

  @OneToMany(() => UserGroupMapping, ugm => ugm.group)
  userGroups: UserGroupMapping[];

  @OneToMany(() => DatasourceAccess, access => access.group)
  databaseAccess: DatasourceAccess[];
}
