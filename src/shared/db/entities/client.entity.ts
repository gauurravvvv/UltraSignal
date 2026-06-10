import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { ClientConfig } from './clientConfig.entity';

// Table: Client

@Entity()
export class Client extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  name!: string;

  // Short, human-readable tenant identifier (4 chars, uppercase alphanumeric).
  // Surfaced in audit exports, support tickets, and tenant-scoped URLs. Set
  // at creation, immutable afterwards. Unique across all clients.
  @Column({ type: 'varchar', length: 4, unique: true })
  clientCode!: string;

  @Column({ nullable: true })
  description!: string;

  @Column({ nullable: true })
  configId: string;

  @OneToOne(() => ClientConfig, config => config.client)
  @JoinColumn({ name: 'configId' })
  config: ClientConfig;

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
