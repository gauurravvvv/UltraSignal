import {
  BaseEntity,
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
import { DatasourceAccess } from './datasource_access.entity';

@Entity()
@Index(['clientId', 'status'])
@Index(['datasourceId'])
export class DatasourceConnection extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: false })
  clientId: string;

  @Column({ nullable: false })
  clientName: string;

  @Column({ nullable: false })
  datasourceId: string;

  @ManyToOne(() => DatasourceS, datasource => datasource.connections)
  @JoinColumn({ name: 'datasourceId' })
  datasource: DatasourceS;

  @Column({ nullable: false })
  dbUsername: string;

  @Column({ nullable: false })
  dbPassword: string;

  @OneToMany(() => DatasourceAccess, access => access.connection)
  accesses: DatasourceAccess[];

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
