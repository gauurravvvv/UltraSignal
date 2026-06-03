import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { DatasourceConnection } from './connections.entity';
import { DatasourceConfigS } from './datasourceConfigS.entity';

@Entity()
@Index(['organisationId', 'status'])
export class DatasourceS extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  name!: string;

  @Column({ nullable: true })
  description!: string;

  @Column({ nullable: false, default: '' })
  organisationName: string;

  @Column({ nullable: false })
  organisationId: string;

  @Column({ nullable: true })
  configId: string;

  @OneToOne(() => DatasourceConfigS, config => config.datasource)
  @JoinColumn({ name: 'configId' })
  config: DatasourceConfigS;

  @OneToMany(() => DatasourceConnection, connection => connection.datasource)
  connections: DatasourceConnection[];

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
