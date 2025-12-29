import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Goal } from './goal.entity';

@Entity('goal_strategy')
export class Strategy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Goal, (goal) => goal.strategies)
  @JoinColumn({ name: 'goal_id' })
  goal: Goal;

  @Column({ name: 'goal_id' })
  goalId: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column({ name: 'order_index', default: 0 })
  orderIndex: number;
}

