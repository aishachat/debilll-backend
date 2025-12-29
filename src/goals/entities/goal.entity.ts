import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Plan } from '../../plans/entities/plan.entity';
import { Task } from '../../tasks/entities/task.entity';
import { Message } from '../../messages/entities/message.entity';
import { Strategy } from './strategy.entity';

export enum GoalStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
}

@Entity('goals')
export class Goal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.goals)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  title: string;

  @Column('text')
  context: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({
    type: 'varchar',
    length: 20,
    default: GoalStatus.ACTIVE,
  })
  status: GoalStatus;

  @Column({ name: 'created_by_ai', default: true })
  createdByAi: boolean;

  @Column({ name: 'plan_id', nullable: true })
  planId: string | null;

  @OneToOne(() => Plan, (plan) => plan.goal, { nullable: true })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan | null;

  @OneToMany(() => Task, (task) => task.goal)
  tasks: Task[];

  @OneToMany(() => Message, (message) => message.goal)
  messages: Message[];

  @OneToMany(() => Strategy, (strategy) => strategy.goal)
  strategies: Strategy[];
}

