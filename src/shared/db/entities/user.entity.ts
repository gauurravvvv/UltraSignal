import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { DatasourceAccess } from './datasource_access.entity';
import { Group } from './group.entity';
import { UserGroupMapping } from './user-group-mapping.entity';

@Entity()
@Index(['clientId', 'status'])
@Index(['email'])
@Index(['username'])
export class User extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  firstName!: string;

  @Column({ nullable: true })
  lastName!: string;

  get fullname(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  @Column()
  email: string;

  @Column({ nullable: true })
  clientId: string;

  @Column({ nullable: false })
  clientName: string;

  @Column()
  username: string;

  @Column({ type: 'varchar', nullable: true })
  password: string | null;

  @Column({ nullable: false, default: false })
  isFirstLogin: boolean;

  @Column({ type: 'varchar', nullable: true })
  otp: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  otpExpiresAt: Date | null;

  @Column({ type: 'varchar', nullable: true, select: false })
  setupToken: string | null;

  @Column({ type: 'timestamptz', nullable: true, select: false })
  setupTokenExpiresAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  sessionId: string | null;

  @Column({ type: 'varchar', nullable: true, select: false })
  refreshToken: string | null;

  @Column({ type: 'timestamptz', nullable: true, select: false })
  refreshTokenExpiresAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLogin: Date | null;

  @Column({
    type: 'enum',
    enum: [0, 1],
    default: 1,
  })
  status!: number;

  @Column({
    type: 'enum',
    enum: [0, 1],
    default: 0,
  })
  isDefault!: number;

  @Column({ type: 'int', default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  accountLockedAt: Date | null;

  @Column({ type: 'varchar', length: 10, default: 'en' })
  locale: string;

  @ManyToMany(() => Group, group => group.users)
  groups: Group[];

  @OneToMany(() => UserGroupMapping, ugm => ugm.user)
  userGroups: UserGroupMapping[];

  @OneToMany(() => DatasourceAccess, access => access.user)
  databaseAccess: DatasourceAccess[];

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
