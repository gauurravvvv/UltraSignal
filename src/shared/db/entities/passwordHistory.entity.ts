import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
// userId is the only access pattern (N-most-recent-passwords lookup);
// indexed because each password write does a list-by-userId before pruning.
@Index(['userId'])
export class PasswordHistory extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  userId: string;

  // Stored encrypted under the platform master key via encryptForClient — same
  // ciphertext format as user.password. Comparison is decrypt-then-equal
  // (UltraSignal crypto is reversible, unlike bcrypt).
  // select: false so a stray .find() doesn't drag encrypted history rows
  // into a response. Callers that need it use .addSelect('password').
  @Column({ type: 'text', nullable: false, select: false })
  password: string;

  // Ordering key — `isPasswordReused` and `savePasswordHistory` both
  // `ORDER BY createdOn DESC` to find the N most recent rows. The
  // `nullable: true` is project convention (TypeORM always populates
  // on insert); the value will never actually be null at read time.
  @CreateDateColumn({ type: 'timestamptz', nullable: true })
  createdOn?: Date;
}
