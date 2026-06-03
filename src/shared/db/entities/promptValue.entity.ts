import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Prompt } from './prompt.entity';

@Entity()
@Index(['promptId'])
export class PromptValue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  promptId: string;

  @ManyToOne(() => Prompt, { nullable: false })
  @JoinColumn({ name: 'promptId' })
  prompt: Prompt;

  @Column({ type: 'text', nullable: false })
  value: string;
}
