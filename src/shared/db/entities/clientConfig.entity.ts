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

  /**
   * Wrapped Data Encryption Key (DEK) for this client's secrets.
   *
   * Format: `v1:<iv_hex>:<authtag_hex>:<encrypted_hex>` — produced by
   * services/crypto.service.ts using AES-256-GCM under the platform
   * master key. The raw DEK is 32 random bytes generated server-side
   * at client creation; only the wrapped form ever touches the database.
   *
   * Nullable for the migration window: legacy clients still carry
   * `pepperKey` + `encryptionAlgorithm` and will be migrated on first
   * use (helpers/client/migrateClientCrypto.ts). After every client
   * has migrated, the two legacy columns can be dropped and this
   * column made non-null.
   */
  @Column({ type: 'text', nullable: true, default: null })
  encryptedDek: string | null;

  /**
   * @deprecated Legacy pepper key from the user-typed scheme. Kept
   * nullable so existing clients continue to read until they're
   * migrated. New clients leave this NULL.
   */
  @Column({ type: 'varchar', nullable: true, default: null })
  pepperKey: string | null;

  /**
   * @deprecated Legacy algorithm picker. Always 'aes-256-gcm' on
   * any newly-created client — the value comes from the crypto service,
   * not from a per-client choice. Nullable for legacy rows.
   */
  @Column({ type: 'varchar', nullable: true, default: null })
  encryptionAlgorithm: string | null;

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
