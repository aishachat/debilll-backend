import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Plan } from '../../plans/entities/plan.entity';
import { Goal } from '../../goals/entities/goal.entity';

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
}

export enum TaskCreatedBy {
  AI = 'ai',
  USER = 'user',
}

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Plan, (plan) => plan.tasks, { nullable: true })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan | null;

  @Column({ name: 'plan_id', nullable: true })
  planId: string | null;

  @ManyToOne(() => Goal, (goal) => goal.tasks)
  @JoinColumn({ name: 'goal_id' })
  goal: Goal;

  @Column({ name: 'goal_id' })
  goalId: string;

  @Column({ type: 'date', nullable: true })
  date: Date | null;

  @Column({ name: 'day_index', nullable: true })
  dayIndex: number | null;

  @Column()
  title: string;

  @Column('text', { nullable: true })
  description: string | null;

  @Column({ name: 'manually_added', default: false })
  manuallyAdded: boolean;

  @Column({
    type: 'varchar',
    length: 10,
    default: TaskPriority.MEDIUM,
  })
  priority: TaskPriority;

  @Column({
    type: 'varchar',
    length: 10,
    default: TaskStatus.TODO,
  })
  status: TaskStatus;

  @Column({
    name: 'created_by',
    type: 'varchar',
    length: 20,
    default: TaskCreatedBy.USER,
  })
  createdBy: TaskCreatedBy;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

