import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { DB_TYPES } from '../../../../config/config';
import { DatasourceS } from './datasourceS.entity';

@Entity()
export class DatasourceConfigS extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => DatasourceS, datasource => datasource.config)
  datasource: DatasourceS;

  // Host / port — used by TypeORM engines (Postgres, MySQL, MariaDB,
  // MSSQL, Oracle). For Snowflake these are stored as empty string /
  // 0 sentinels; Snowflake's connection identity lives in `account`
  // + `warehouse` below. Kept non-nullable so existing controllers
  // that pass database.config.hostname into getDbConnection() don't
  // need to deal with `string | undefined` everywhere — the dbType
  // check at the call site decides which path to take.
  @Column({ nullable: false, default: '' })
  hostname: string;

  @Column({ nullable: false, default: 0 })
  port: number;

  @Column({ nullable: false })
  dbName: string;

  @Column({ nullable: false })
  username: string;

  @Column({ nullable: false })
  password: string;

  @Column({
    type: 'enum',
    enum: Object.values(DB_TYPES),
    nullable: false,
    default: DB_TYPES.POSTGRES,
  })
  dbType: string;

  // ── Snowflake-specific fields ───────────────────────────────────────
  // Snowflake doesn't fit the host+port shape. Connection identity is
  // an `account` (e.g. xy12345.us-east-1.aws), a virtual `warehouse`
  // that runs queries, a `role` for access scope, and an optional
  // default `schema` inside the database. The DB name reuses dbName.
  // Username + password reuse the shared columns above. All four are
  // nullable so the entity stays valid for TypeORM engines.
  @Column({ nullable: true })
  account?: string;

  @Column({ nullable: true })
  warehouse?: string;

  @Column({ nullable: true })
  role?: string;

  @Column({ nullable: true })
  schemaName?: string;

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
