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
import { Client } from './client.entity';

@Entity()
export class ClientConfig extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Client, client => client.config)
  client: Client;

  // Crypto: every client's secrets are encrypted with the single
  // platform master key (ULTRASIGNAL_MASTER_KEY in .env). No
  // per-client DEK row — see shared/services/crypto.service.ts.

  // Security Settings
  @Column({ type: 'int', default: 5 })
  maxLoginAttempts: number;

  @Column({ type: 'real', default: 1 })
  accountLockDurationHours: number;

  @Column({ type: 'int', default: 5 })
  passwordHistoryLimit: number;

  @Column({ type: 'int', default: 30 })
  sessionInactivityTimeout: number;

  // Email Configuration
  @Column({ type: 'varchar', nullable: true, default: null })
  emailProvider: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  smtpHost: string | null;

  @Column({ type: 'int', nullable: true, default: null })
  smtpPort: number | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  smtpUser: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  smtpPassword: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  smtpFrom: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  sesRegion: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  sesAccessKeyId: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  sesSecretAccessKey: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  sesFrom: string | null;

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
