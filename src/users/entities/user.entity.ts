import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Goal } from '../../goals/entities/goal.entity';
import { Message } from '../../messages/entities/message.entity';
import { Integration } from '../../integrations/entities/integration.entity';
import { Subscription } from '../../integrations/entities/subscription.entity';

export enum SubscriptionTier {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ length: 5, default: 'ru' })
  lang: string;

  @Column({
    name: 'subscription_tier',
    type: 'varchar',
    length: 32,
    default: SubscriptionTier.FREE,
  })
  subscriptionTier: SubscriptionTier;

  @Column('jsonb', { default: {} })
  settings: {
    weekends?: boolean;
    defaultDailyHours?: number;
    notifyTime?: string;
    dailyTimeLimitMins?: number;
    [key: string]: any;
  };

  @OneToMany(() => Goal, (goal) => goal.user)
  goals: Goal[];

  @OneToMany(() => Message, (message) => message.user)
  messages: Message[];

  @OneToMany(() => Integration, (integration) => integration.user)
  integrations: Integration[];

  @OneToMany(() => Subscription, (subscription) => subscription.user)
  subscriptions: Subscription[];
}

