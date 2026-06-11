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
  VersionColumn,
} from 'typeorm';
import { DataSourceType } from './data-source-type.entity';

/**
 * Per-client Data Source instance — the tenant configures one row per
 * upstream feed they want to ingest. References a `DataSourceType` (AEMS,
 * UAN, ...) from the system catalog.
 *
 * Unique by (name, clientId) so two clients can use the same display name
 * without collision, but a single client can't have two sources with the
 * same name.
 */
@Entity('data_source')
@Index(['clientId', 'status'])
@Index(['name', 'clientId'], { unique: true })
export class DataSource extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ type: 'uuid' })
  typeId: string;

  @ManyToOne(() => DataSourceType, { eager: false })
  @JoinColumn({ name: 'typeId' })
  type: DataSourceType;

  /**
   * Connection details supplied by the tenant at create time. `typeId` is
   * immutable; the rest are editable. `password` is encrypted with the
   * platform master key (env: ULTRASIGNAL_MASTER_KEY) via
   * `encryptForClient` before storage, and marked `select: false` so it
   * NEVER appears in default findOne / find results — it has to be
   * pulled explicitly with `.addSelect('ds.password')` when the
   * ingestion pipeline needs it.
   */
  @Column({ type: 'varchar', length: 255 })
  host: string;

  @Column({ type: 'int' })
  port: number;

  @Column({ type: 'varchar', length: 128 })
  dbname: string;

  @Column({ type: 'varchar', length: 128 })
  username: string;

  @Column({ type: 'varchar', length: 1024, select: false })
  password: string;

  @Column({ type: 'varchar', length: 64 })
  schema: string;

  @Column({ nullable: false })
  clientId: string;

  @Column({ nullable: false })
  clientName: string;

  @Column({
    type: 'enum',
    enum: [0, 1],
    default: 1,
  })
  status: number;

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
