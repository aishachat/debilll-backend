import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum IntegrationProvider {
  GOOGLE_CALENDAR = 'google_calendar',
}

@Entity('integrations')
export class Integration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.integrations)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  provider: IntegrationProvider;

  @Column('jsonb') // Encrypted token storage
  token: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    [key: string]: any;
  };

  @CreateDateColumn({ name: 'connected_at' })
  connectedAt: Date;
}

