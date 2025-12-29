export interface StrategyItem {
  title: string;
  description: string;
}

export interface PlanTask {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  day_index: number;
}

export interface PlanResponse {
  strategy: StrategyItem[];
  tasks: PlanTask[];
  days_count: number;
}

