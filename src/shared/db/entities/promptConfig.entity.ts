import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Prompt } from './prompt.entity';

@Entity()
@Index(['promptId'], { unique: true })
export class PromptConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  promptId: string;

  @OneToOne(() => Prompt, { nullable: false })
  @JoinColumn({ name: 'promptId' })
  prompt: Prompt;

  @Column({ nullable: false })
  prompt_schema: string;

  @Column({ nullable: false })
  prompt_table: string;

  @Column({ nullable: false })
  prompt_column: string;

  @Column({ type: 'text', nullable: false })
  prompt_join: string;

  @Column({ type: 'text', nullable: false })
  prompt_where: string;

  @Column({ type: 'text', nullable: false })
  prompt_sql: string;

  @Column({ type: 'text', nullable: true })
  prompt_values_sql: string;

  @Column({ type: 'json', nullable: false, default: {} })
  appearance: any;
}
