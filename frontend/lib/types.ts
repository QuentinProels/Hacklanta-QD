export interface Profile {
  id: string;
  name: string;
  slug: string;
  is_sample: boolean;
  current_age: number;
  career_path: string;
  career_level_index: number;
  annual_salary: number;
  monthly_take_home: number;
  employer_match_pct: number;
  retirement_target_age: number;
  desired_monthly_retirement_income: number;
  safe_withdrawal_rate: number;
  salary_progression?: { age: number; salary: number; label?: string }[] | null;
}

export interface Expense {
  id: string;
  profile_id: string;
  category: string;
  label: string;
  amount: number;
  is_custom: boolean;
}

export interface Debt {
  id: string;
  profile_id: string;
  name: string;
  balance: number;
  apr: number;
  min_payment: number;
}

export interface Asset {
  id: string;
  profile_id: string;
  type: string;
  balance: number;
}

export interface RetirementLifestyle {
  id?: string;
  profile_id?: string;
  lifestyle_type: 'goal' | 'predicted';
  housing_monthly: number;
  food_monthly: number;
  healthcare_monthly: number;
  travel_annual: number;
  leisure_monthly: number;
  transportation_monthly: number;
  utilities_monthly: number;
  other_monthly: number;
}

export function lifestyleTotalMonthly(l: RetirementLifestyle): number {
  return (
    l.housing_monthly +
    l.food_monthly +
    l.healthcare_monthly +
    l.leisure_monthly +
    l.transportation_monthly +
    l.utilities_monthly +
    l.other_monthly +
    l.travel_annual / 12
  );
}

export interface FullProfile {
  profile: Profile;
  expenses: Expense[];
  debts: Debt[];
  assets: Asset[];
  retirementLifestyles?: {
    goal: RetirementLifestyle | null;
    predicted: RetirementLifestyle | null;
  };
}

export interface FireResult {
  goal_fire_age: number | null;
  goal_fire_target: number;
  goal_achievable: boolean;
  predicted_fire_age: number | null;
  predicted_fire_target: number;
  predicted_achievable: boolean;
}

export interface SimulationResult {
  percentiles: {
    p10: { age: number; net_worth: number }[];
    p25: { age: number; net_worth: number }[];
    p50: { age: number; net_worth: number }[];
    p75: { age: number; net_worth: number }[];
    p90: { age: number; net_worth: number }[];
  };
  fire_milestones: FireResult;
  retirement_readiness_score: number;
  gap_analysis: Record<string, any>;
}

export interface DebtPayoffResult {
  avalanche: {
    total_months: number;
    total_interest_paid: number;
    payoff_schedule: { name: string; payoff_month: number; interest_paid: number }[];
    monthly_balances: Record<string, number>[];
  };
  snowball: {
    total_months: number;
    total_interest_paid: number;
    payoff_schedule: { name: string; payoff_month: number; interest_paid: number }[];
    monthly_balances: Record<string, number>[];
  };
  interest_saved_avalanche: number;
}

export interface BudgetBenchmark {
  category: string;
  label: string;
  amount: number;
  actual_pct: number;
  guideline_max_pct: number;
  status: 'green' | 'yellow' | 'red';
}

export interface BudgetAnalysisResult {
  surplus: number;
  is_deficit: boolean;
  benchmarks: BudgetBenchmark[];
  alerts: { severity: string; message: string }[];
}

export interface AiInsightsResult {
  budget_roast: string;
  debt_strategy: string;
  allocation_advice: string;
}

export interface CareerPath {
  label: string;
  progression: {
    level: string;
    years_range: number[];
    salary_range: number[];
    median: number;
  }[];
}

export interface CareerPaths {
  [key: string]: CareerPath;
}
