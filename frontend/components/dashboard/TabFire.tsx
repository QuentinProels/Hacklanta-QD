'use client';

import { useEffect, useState, useCallback } from 'react';
import { runSimulation } from '@/lib/api';
import type { FullProfile, SimulationResult } from '@/lib/types';
import { lifestyleTotalMonthly } from '@/lib/types';
import FanChart from '@/components/charts/FanChart';
import careerPaths from '@/data/career_paths.json';
import type { CareerPaths } from '@/lib/types';

const careers = careerPaths as CareerPaths;

function buildSalaryProgression(profile: FullProfile['profile']) {
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

export default function TabFire({ data }: { data: FullProfile }) {
  const [sim, setSim] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(true);

  // What-if sliders
  const [extraIncome, setExtraIncome] = useState(0);
  const [extraSavings, setExtraSavings] = useState(0);
  const [retireAge, setRetireAge] = useState(data.profile.retirement_target_age);

  const { profile, expenses, debts, assets, retirementLifestyles } = data;

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalDebtPayments = debts.reduce((s, d) => s + d.min_payment, 0);
  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const surplus = profile.monthly_take_home - totalExpenses - totalDebtPayments;

  // Get retirement income targets from lifestyle data, or fall back to profile defaults
  const goalMonthly = retirementLifestyles?.goal
    ? lifestyleTotalMonthly(retirementLifestyles.goal)
    : profile.desired_monthly_retirement_income || 5000;
  const predictedMonthly = retirementLifestyles?.predicted
    ? lifestyleTotalMonthly(retirementLifestyles.predicted)
    : goalMonthly * 0.7;

  const fetchSimulation = useCallback(async () => {
    setLoading(true);
    try {
      const adjustedSalary = profile.annual_salary + extraIncome;
      const adjustedSavings = Math.max(0, surplus + extraSavings);

      const result = await runSimulation({
        current_age: profile.current_age,
        retirement_target_age: retireAge,
        annual_salary: adjustedSalary,
        salary_progression: buildSalaryProgression(profile).map((sp) => ({
          ...sp,
          salary: sp.salary + extraIncome,
        })),
        monthly_expenses: totalExpenses,
        monthly_debt_payments: totalDebtPayments,
        total_debt: totalDebt,
        current_assets: {
          retirement_accounts: assets.filter((a) => ['401k', 'roth_ira'].includes(a.type)).reduce((s, a) => s + a.balance, 0),
          taxable: assets.filter((a) => a.type === 'brokerage').reduce((s, a) => s + a.balance, 0),
          savings: assets.filter((a) => a.type === 'savings').reduce((s, a) => s + a.balance, 0),
        },
        monthly_savings_rate: adjustedSavings,
        employer_match_pct: profile.employer_match_pct,
        safe_withdrawal_rate: profile.safe_withdrawal_rate,
        goal_monthly_retirement_income: goalMonthly,
        predicted_monthly_retirement_income: predictedMonthly,
      });
      setSim(result as SimulationResult);
    } catch (err) {
      console.error('Simulation failed:', err);
    }
    setLoading(false);
  }, [data, extraIncome, extraSavings, retireAge]);

  useEffect(() => {
    const timeout = setTimeout(fetchSimulation, 500);
    return () => clearTimeout(timeout);
  }, [fetchSimulation]);

  const fm = sim?.fire_milestones;

  return (
    <div className="space-y-8">
      {/* Fan Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Monte Carlo Projection</h3>
        {loading && !sim ? (
          <div className="h-80 flex items-center justify-center text-gray-400 animate-pulse">Running 1,000 simulations...</div>
        ) : sim ? (
          <FanChart data={sim} currentAge={profile.current_age} />
        ) : null}
      </div>

      {/* FIRE Milestones — Goal vs Predicted */}
      {fm && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Goal FIRE */}
          <div className={`rounded-xl border-2 p-6 ${fm.goal_achievable ? 'border-amber-400 bg-amber-50' : 'border-gray-300 bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-amber-700">Goal Lifestyle FIRE</p>
              <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">
                ${goalMonthly.toLocaleString()}/mo
              </span>
            </div>
            <p className={`text-4xl font-bold my-2 ${fm.goal_achievable ? 'text-gray-900' : 'text-gray-300'}`}>
              {fm.goal_achievable && fm.goal_fire_age ? `Retire at ${fm.goal_fire_age}` : 'Not achievable'}
            </p>
            <p className="text-xs text-gray-500">
              Target: ${(fm.goal_fire_target / 1_000_000).toFixed(1)}M invested (25x ${(goalMonthly * 12).toLocaleString()}/yr)
            </p>
            {fm.goal_achievable && fm.goal_fire_age && (
              <p className="text-sm text-amber-700 mt-2">
                {fm.goal_fire_age - profile.current_age} years from now
              </p>
            )}
          </div>

          {/* Predicted FIRE */}
          <div className={`rounded-xl border-2 p-6 ${fm.predicted_achievable ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-blue-700">Predicted Lifestyle FIRE</p>
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                ${predictedMonthly.toLocaleString()}/mo
              </span>
            </div>
            <p className={`text-4xl font-bold my-2 ${fm.predicted_achievable ? 'text-gray-900' : 'text-gray-300'}`}>
              {fm.predicted_achievable && fm.predicted_fire_age ? `Retire at ${fm.predicted_fire_age}` : 'Not achievable'}
            </p>
            <p className="text-xs text-gray-500">
              Target: ${(fm.predicted_fire_target / 1_000_000).toFixed(1)}M invested (25x ${(predictedMonthly * 12).toLocaleString()}/yr)
            </p>
            {fm.predicted_achievable && fm.predicted_fire_age && (
              <p className="text-sm text-blue-700 mt-2">
                {fm.predicted_fire_age - profile.current_age} years from now
              </p>
            )}
          </div>
        </div>
      )}

      {/* Comparison insight */}
      {fm && fm.goal_achievable && fm.predicted_achievable && fm.goal_fire_age && fm.predicted_fire_age && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-sm text-green-700">
            Your predicted lifestyle lets you retire <strong>{fm.goal_fire_age - fm.predicted_fire_age} years earlier</strong> than
            your goal lifestyle. Adjusting your retirement expectations could mean the difference between retiring at{' '}
            <strong>{fm.predicted_fire_age}</strong> vs <strong>{fm.goal_fire_age}</strong>.
          </p>
        </div>
      )}

      {fm && !fm.goal_achievable && fm.predicted_achievable && fm.predicted_fire_age && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
          <p className="text-sm text-yellow-700">
            Your goal lifestyle isn&apos;t achievable on your current trajectory, but your predicted lifestyle
            would let you retire at <strong>{fm.predicted_fire_age}</strong>. Consider adjusting your
            retirement goals on the Retirement Lifestyle tab.
          </p>
        </div>
      )}

      {fm && !fm.goal_achievable && !fm.predicted_achievable && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-sm text-red-700">
            Neither your goal nor predicted retirement lifestyle is achievable on your current trajectory.
            Use the sliders below to explore what changes could make retirement possible.
          </p>
        </div>
      )}

      {/* What-If Sliders */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">What If...?</h3>
        <div className="space-y-6">
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Extra annual income: <span className="font-semibold text-blue-600">+${extraIncome.toLocaleString()}/yr</span>
            </label>
            <input type="range" min={0} max={100000} step={5000} value={extraIncome} onChange={(e) => setExtraIncome(Number(e.target.value))} className="w-full accent-blue-600" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Extra monthly savings: <span className="font-semibold text-blue-600">+${extraSavings.toLocaleString()}/mo</span>
            </label>
            <input type="range" min={0} max={3000} step={100} value={extraSavings} onChange={(e) => setExtraSavings(Number(e.target.value))} className="w-full accent-blue-600" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Retire at age: <span className="font-semibold text-blue-600">{retireAge}</span>
            </label>
            <input type="range" min={35} max={70} value={retireAge} onChange={(e) => setRetireAge(Number(e.target.value))} className="w-full accent-blue-600" />
          </div>
        </div>
        {loading && <p className="text-xs text-gray-400 mt-3 animate-pulse">Recalculating...</p>}
      </div>

      {/* Gap Analysis */}
      {sim && sim.gap_analysis?.goal_fire_by_50 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-2">Gap Analysis</h3>
          <p className="text-sm text-gray-600">
            To reach your goal lifestyle FIRE by 50, you&apos;d need to reach a salary of approximately{' '}
            <span className="font-bold">
              ${Object.values(sim.gap_analysis.goal_fire_by_50.required_salary_by_age || {})[1]?.toLocaleString() || 'N/A'}
            </span>{' '}
            by age {Object.keys(sim.gap_analysis.goal_fire_by_50.required_salary_by_age || {})[1] || '?'}.
          </p>
          {sim.gap_analysis.goal_fire_by_50.suggested_roles && (
            <p className="text-sm text-gray-500 mt-2">
              Roles that typically pay this: {sim.gap_analysis.goal_fire_by_50.suggested_roles.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
