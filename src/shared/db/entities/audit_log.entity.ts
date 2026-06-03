import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('audit_log')
@Index(['organisationId', 'module'])
@Index(['userId'])
@Index(['createdOn'])
@Index(['action'])
export class AuditLog extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', nullable: true })
  organisationId: string | null;

  @Column({ nullable: false })
  module: string;

  @Column({ nullable: false })
  action: string;

  @Column({ type: 'varchar', nullable: true })
  entityName: string | null;

  @Column({ type: 'varchar', nullable: true })
  entityId: string | null;

  @Column({ type: 'varchar', nullable: true })
  requestMethod: string | null;

  @Column({ type: 'varchar', nullable: true })
  requestPath: string | null;

  @Column({ type: 'json', nullable: true })
  requestBody: any;

  @Column({ nullable: true })
  responseCode: number;

  @Column({ nullable: true })
  responseSuccess: boolean;

  @Column({ type: 'varchar', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', nullable: true })
  userAgent: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: any;

  @Column({ type: 'text', nullable: true })
  justification: string | null;

  @Column({ type: 'int', default: 1 })
  version: number;

  @CreateDateColumn()
  createdOn: Date;
}
