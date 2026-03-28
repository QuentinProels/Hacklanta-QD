'use client';

import { useEffect, useState } from 'react';
import { getBudgetAnalysis, runSimulation } from '@/lib/api';
import type { FullProfile, BudgetAnalysisResult, SimulationResult } from '@/lib/types';
import { lifestyleTotalMonthly } from '@/lib/types';
import CashFlowBar from '@/components/charts/CashFlowBar';
import careerPaths from '@/data/career_paths.json';
import type { CareerPaths } from '@/lib/types';

const careers = careerPaths as CareerPaths;

function buildSalaryProgression(profile: FullProfile['profile']) {
  // Use custom salary progression if stored on the profile
  if (profile.salary_progression && profile.salary_progression.length > 0) {
    return profile.salary_progression.map((sp) => ({ age: sp.age, salary: sp.salary }));
  }
  const path = careers[profile.career_path];
  if (!path) return [{ age: profile.current_age, salary: profile.annual_salary }];
  return path.progression.map((level) => ({
    age: profile.current_age + level.years_range[0],
    salary: level.median,
  }));
}

export default function TabOverview({ data }: { data: FullProfile }) {
  const [budget, setBudget] = useState<BudgetAnalysisResult | null>(null);
  const [sim, setSim] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(true);

  const { profile, expenses, debts, assets, retirementLifestyles } = data;

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalDebtPayments = debts.reduce((s, d) => s + d.min_payment, 0);
  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const surplus = profile.monthly_take_home - totalExpenses - totalDebtPayments;

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const expenseMap: Record<string, number> = {};
        expenses.forEach((e) => { expenseMap[e.category] = (expenseMap[e.category] || 0) + e.amount; });

        const [budgetRes, simRes] = await Promise.all([
          getBudgetAnalysis({
            monthly_take_home: profile.monthly_take_home,
            expenses: expenseMap,
            total_debt_payments: totalDebtPayments,
            total_monthly_expenses: totalExpenses,
          }),
          runSimulation({
            current_age: profile.current_age,
            retirement_target_age: profile.retirement_target_age,
            annual_salary: profile.annual_salary,
            salary_progression: buildSalaryProgression(profile),
            monthly_expenses: totalExpenses,
            monthly_debt_payments: totalDebtPayments,
            total_debt: totalDebt,
            current_assets: {
              retirement_accounts: assets.filter((a) => ['401k', 'roth_ira'].includes(a.type)).reduce((s, a) => s + a.balance, 0),
              taxable: assets.filter((a) => a.type === 'brokerage').reduce((s, a) => s + a.balance, 0),
              savings: assets.filter((a) => a.type === 'savings').reduce((s, a) => s + a.balance, 0),
            },
            monthly_savings_rate: Math.max(0, surplus),
            employer_match_pct: profile.employer_match_pct,
            safe_withdrawal_rate: profile.safe_withdrawal_rate,
            goal_monthly_retirement_income: retirementLifestyles?.goal
              ? lifestyleTotalMonthly(retirementLifestyles.goal)
              : profile.desired_monthly_retirement_income || 5000,
            predicted_monthly_retirement_income: retirementLifestyles?.predicted
              ? lifestyleTotalMonthly(retirementLifestyles.predicted)
              : (profile.desired_monthly_retirement_income || 5000) * 0.7,
          }),
        ]);

        setBudget(budgetRes as BudgetAnalysisResult);
        setSim(simRes as SimulationResult);
      } catch (err) {
        console.error('Failed to load overview data:', err);
      }
      setLoading(false);
    }
    fetchData();
  }, [data]);

  if (loading) {
    return <div className="animate-pulse text-gray-400 py-12 text-center">Calculating your overview...</div>;
  }

  const score = sim?.retirement_readiness_score ?? 0;
  const scoreColor = score >= 70 ? 'text-green-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600';
  const scoreBg = score >= 70 ? 'bg-green-50 border-green-200' : score >= 40 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';

  return (
    <div className="space-y-8">
      {/* Score + FIRE Summary Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Retirement Readiness Score */}
        <div className={`rounded-xl border-2 p-6 text-center ${scoreBg}`}>
          <p className="text-sm font-medium text-gray-600 mb-2">Retirement Readiness Score</p>
          <p className={`text-6xl font-bold ${scoreColor}`}>{score}</p>
          <p className="text-sm text-gray-500 mt-1">out of 100</p>
        </div>

        {/* FIRE Timeline Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600 mb-4">FIRE Timeline</p>
          {sim && (
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 rounded-lg bg-amber-50">
                <p className="text-xs text-amber-600 font-medium">Goal Lifestyle</p>
                <p className={`text-2xl font-bold ${sim.fire_milestones.goal_achievable ? 'text-gray-900' : 'text-gray-300'}`}>
                  {sim.fire_milestones.goal_achievable && sim.fire_milestones.goal_fire_age
                    ? `Retire at ${sim.fire_milestones.goal_fire_age}`
                    : 'N/A'}
                </p>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-50">
                <p className="text-xs text-blue-600 font-medium">Predicted Lifestyle</p>
                <p className={`text-2xl font-bold ${sim.fire_milestones.predicted_achievable ? 'text-gray-900' : 'text-gray-300'}`}>
                  {sim.fire_milestones.predicted_achievable && sim.fire_milestones.predicted_fire_age
                    ? `Retire at ${sim.fire_milestones.predicted_fire_age}`
                    : 'N/A'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cash Flow */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-sm font-medium text-gray-600 mb-4">Monthly Cash Flow</p>
        <CashFlowBar
          income={profile.monthly_take_home}
          expenses={totalExpenses}
          debtPayments={totalDebtPayments}
          surplus={surplus}
        />
      </div>

      {/* Top Alerts */}
      {budget && budget.alerts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600 mb-4">Top Alerts</p>
          <div className="space-y-3">
            {budget.alerts.slice(0, 5).map((alert, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  alert.severity === 'red'
                    ? 'bg-red-50 border border-red-200'
                    : alert.severity === 'yellow'
                    ? 'bg-yellow-50 border border-yellow-200'
                    : 'bg-green-50 border border-green-200'
                }`}
              >
                <span className="text-lg">
                  {alert.severity === 'red' ? '\u{1F534}' : alert.severity === 'yellow' ? '\u{1F7E1}' : '\u{1F7E2}'}
                </span>
                <p className="text-sm text-gray-700">{alert.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
