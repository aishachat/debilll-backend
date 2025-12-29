import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Goal } from '../../goals/entities/goal.entity';
import { Task } from '../../tasks/entities/task.entity';

export interface PlanDay {
  date: string; // YYYY-MM-DD
  tasks: PlanTask[];
}

export interface PlanTask {
  id: string;
  title: string;
  description?: string;
  duration_mins: number;
  priority: 'low' | 'medium' | 'high';
  tags?: string[];
  created_by?: 'ai' | 'user';
}

export interface PlanMeta {
  total_days: number;
  avg_daily_duration: number;
  constraints?: {
    no_weekends?: boolean;
    daily_time_limit_mins?: number;
  };
  milestones?: string[];
}

export interface PlanContent {
  days: PlanDay[];
  meta: PlanMeta;
}

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Goal, (goal) => goal.plan)
  @JoinColumn({ name: 'goal_id' })
  goal: Goal;

  @Column({ name: 'goal_id' })
  goalId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'generated_by', length: 50 })
  generatedBy: string; // e.g., "gpt-4.1"

  @Column('jsonb')
  content: PlanContent;

  @Column({ name: 'snapshot_version', default: 1 })
  snapshotVersion: number;

  @OneToMany(() => Task, (task) => task.plan)
  tasks: Task[];
}

