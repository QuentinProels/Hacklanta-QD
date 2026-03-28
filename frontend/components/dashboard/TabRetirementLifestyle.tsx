'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { runSimulation } from '@/lib/api';
import type { FullProfile, RetirementLifestyle, SimulationResult, CareerPaths } from '@/lib/types';
import { lifestyleTotalMonthly } from '@/lib/types';
import { Save, Check, Home, UtensilsCrossed, HeartPulse, Plane, Music, Car, Zap, MoreHorizontal, RefreshCw, Calculator } from 'lucide-react';
import careerPaths from '@/data/career_paths.json';

const careers = careerPaths as CareerPaths;

interface Props {
  data: FullProfile;
  onSaved: () => void;
}

const EMPTY_LIFESTYLE: RetirementLifestyle = {
  lifestyle_type: 'goal',
  housing_monthly: 0,
  food_monthly: 0,
  healthcare_monthly: 0,
  travel_annual: 0,
  leisure_monthly: 0,
  transportation_monthly: 0,
  utilities_monthly: 0,
  other_monthly: 0,
};

const CATEGORIES = [
  { key: 'housing_monthly', label: 'Housing', icon: Home, period: 'mo' },
  { key: 'food_monthly', label: 'Food & Groceries', icon: UtensilsCrossed, period: 'mo' },
  { key: 'healthcare_monthly', label: 'Healthcare', icon: HeartPulse, period: 'mo' },
  { key: 'travel_annual', label: 'Travel', icon: Plane, period: 'yr' },
  { key: 'leisure_monthly', label: 'Leisure & Entertainment', icon: Music, period: 'mo' },
  { key: 'transportation_monthly', label: 'Transportation', icon: Car, period: 'mo' },
  { key: 'utilities_monthly', label: 'Utilities', icon: Zap, period: 'mo' },
  { key: 'other_monthly', label: 'Other', icon: MoreHorizontal, period: 'mo' },
] as const;

type CategoryKey = typeof CATEGORIES[number]['key'];

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

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

// Scale goal lifestyle down to fit a sustainable monthly budget
function scaleGoalToTarget(goal: RetirementLifestyle, targetMonthly: number): RetirementLifestyle {
  const goalTotal = lifestyleTotalMonthly(goal);
  if (goalTotal <= 0) return { ...EMPTY_LIFESTYLE, lifestyle_type: 'predicted' };

  const ratio = Math.min(targetMonthly / goalTotal, 1); // never scale up beyond goal

  return {
    lifestyle_type: 'predicted',
    housing_monthly: Math.round(goal.housing_monthly * ratio),
    food_monthly: Math.round(goal.food_monthly * ratio),
    healthcare_monthly: Math.round(goal.healthcare_monthly * ratio),
    travel_annual: Math.round(goal.travel_annual * ratio),
    leisure_monthly: Math.round(goal.leisure_monthly * ratio),
    transportation_monthly: Math.round(goal.transportation_monthly * ratio),
    utilities_monthly: Math.round(goal.utilities_monthly * ratio),
    other_monthly: Math.round(goal.other_monthly * ratio),
  };
}

const COL_TIERS = [
  {
    label: 'High Cost of Living',
    examples: 'NYC, SF Bay Area, Boston, LA, Seattle, DC',
    minimum: 4500,
    comfortable: 7000,
    color: 'red',
  },
  {
    label: 'Medium Cost of Living',
    examples: 'Atlanta, Denver, Austin, Chicago, Portland, Nashville',
    minimum: 3000,
    comfortable: 5000,
    color: 'yellow',
  },
  {
    label: 'Low Cost of Living',
    examples: 'Rural areas, smaller cities in the South/Midwest, international (Mexico, Portugal, Thailand)',
    minimum: 1800,
    comfortable: 3200,
    color: 'green',
  },
];

function CostOfLivingCheck({ monthlyBudget }: { monthlyBudget: number }) {
  if (monthlyBudget <= 0) return null;

  // Determine which tiers the budget fits
  const viable = COL_TIERS.filter((t) => monthlyBudget >= t.minimum);
  const comfortable = COL_TIERS.filter((t) => monthlyBudget >= t.comfortable);
  const belowAll = viable.length === 0;

  const colorClasses: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', dot: 'bg-yellow-500' },
    green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', dot: 'bg-green-500' },
  };

  return (
    <div className={`rounded-xl border-2 p-5 ${belowAll ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'}`}>
      <p className="text-sm font-semibold text-gray-700 mb-3">
        Can you live on {formatMoney(monthlyBudget)}/mo?
      </p>

      {belowAll && (
        <div className="bg-red-100 border border-red-300 rounded-lg p-3 mb-3">
          <p className="text-sm text-red-800 font-medium">
            {formatMoney(monthlyBudget)}/mo is below the minimum livable budget in most US areas.
            Even in the lowest cost-of-living areas, a single person typically needs at least ~$1,800/mo
            for basic housing, food, and healthcare. Consider adjusting your savings plan or retirement timeline.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {COL_TIERS.map((tier) => {
          const c = colorClasses[tier.color];
          const isViable = monthlyBudget >= tier.minimum;
          const isComfortable = monthlyBudget >= tier.comfortable;

          return (
            <div
              key={tier.label}
              className={`flex items-center gap-3 rounded-lg p-3 ${isViable ? c.bg : 'bg-gray-50'} ${isViable ? c.border : 'border-gray-200'} border`}
            >
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isViable ? c.dot : 'bg-gray-300'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-medium ${isViable ? c.text : 'text-gray-400'}`}>
                    {tier.label}
                  </p>
                  {isComfortable && (
                    <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                      COMFORTABLE
                    </span>
                  )}
                  {isViable && !isComfortable && (
                    <span className="text-[10px] font-semibold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                      TIGHT
                    </span>
                  )}
                  {!isViable && (
                    <span className="text-[10px] font-semibold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                      NOT VIABLE
                    </span>
                  )}
                </div>
                <p className={`text-xs ${isViable ? 'text-gray-500' : 'text-gray-400'}`}>
                  {tier.examples}
                </p>
                <p className={`text-xs ${isViable ? 'text-gray-500' : 'text-gray-400'}`}>
                  Min: {formatMoney(tier.minimum)}/mo &middot; Comfortable: {formatMoney(tier.comfortable)}/mo
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TabRetirementLifestyle({ data, onSaved }: Props) {
  const { profile, expenses, debts, assets } = data;

  const [goal, setGoal] = useState<RetirementLifestyle>(
    data.retirementLifestyles?.goal || { ...EMPTY_LIFESTYLE, lifestyle_type: 'goal' }
  );
  const [predicted, setPredicted] = useState<RetirementLifestyle>(
    data.retirementLifestyles?.predicted || { ...EMPTY_LIFESTYLE, lifestyle_type: 'predicted' }
  );
  const [predictedOverridden, setPredictedOverridden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [sustainableMonthly, setSustainableMonthly] = useState<number | null>(null);

  // Reset state when profile changes
  useEffect(() => {
    setGoal(data.retirementLifestyles?.goal || { ...EMPTY_LIFESTYLE, lifestyle_type: 'goal' });
    setPredicted(data.retirementLifestyles?.predicted || { ...EMPTY_LIFESTYLE, lifestyle_type: 'predicted' });
    setPredictedOverridden(false);
    setDirty(false);
    setSaved(false);
    setSustainableMonthly(null);
  }, [profile.id]);

  // Compute sustainable monthly income from simulation
  const computePredicted = useCallback(async () => {
    setCalculating(true);
    try {
      const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
      const totalDebtPayments = debts.reduce((s, d) => s + d.min_payment, 0);
      const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
      const surplus = profile.monthly_take_home - totalExpenses - totalDebtPayments;
      const goalTotal = lifestyleTotalMonthly(goal);

      const sim = await runSimulation({
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
        goal_monthly_retirement_income: goalTotal || 5000,
        predicted_monthly_retirement_income: goalTotal * 0.7 || 3500,
      }) as SimulationResult;

      // Find median NW at retirement_target_age
      const retireIdx = profile.retirement_target_age - profile.current_age;
      const p50 = sim.percentiles.p50;
      const nwAtRetire = retireIdx >= 0 && retireIdx < p50.length
        ? p50[retireIdx].net_worth
        : 0;

      // Sustainable monthly = NW * SWR / 12
      const swr = profile.safe_withdrawal_rate || 0.04;
      const sustainable = (nwAtRetire * swr) / 12;
      setSustainableMonthly(sustainable);

      // Auto-populate predicted by scaling goal categories
      if (!predictedOverridden) {
        const newPredicted = scaleGoalToTarget(goal, sustainable);
        setPredicted(newPredicted);
        setDirty(true);
      }
    } catch (err) {
      console.error('Failed to compute predicted lifestyle:', err);
    }
    setCalculating(false);
  }, [profile, expenses, debts, assets, goal, predictedOverridden]);

  // Auto-compute on first load when goal exists but predicted is empty/zero
  useEffect(() => {
    const goalTotal = lifestyleTotalMonthly(goal);
    const predTotal = lifestyleTotalMonthly(predicted);
    if (goalTotal > 0 && predTotal === 0 && !calculating) {
      computePredicted();
    }
  }, [goal, profile.id]);

  const goalTotal = lifestyleTotalMonthly(goal);
  const predictedTotal = lifestyleTotalMonthly(predicted);
  const coveragePct = goalTotal > 0 ? Math.round((predictedTotal / goalTotal) * 100) : 0;

  const updateGoal = (key: CategoryKey, value: number) => {
    setGoal({ ...goal, [key]: value });
    setDirty(true);
    setSaved(false);
  };

  const updatePredicted = (key: CategoryKey, value: number) => {
    setPredicted({ ...predicted, [key]: value });
    setPredictedOverridden(true);
    setDirty(true);
    setSaved(false);
  };

  const recalcPredicted = () => {
    setPredictedOverridden(false);
    computePredicted();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const goalRow = { ...goal, profile_id: profile.id, lifestyle_type: 'goal' as const };
      delete (goalRow as any).id;
      await supabase.from('retirement_lifestyles').upsert(goalRow, {
        onConflict: 'profile_id,lifestyle_type',
      });

      const predRow = { ...predicted, profile_id: profile.id, lifestyle_type: 'predicted' as const };
      delete (predRow as any).id;
      await supabase.from('retirement_lifestyles').upsert(predRow, {
        onConflict: 'profile_id,lifestyle_type',
      });

      setSaved(true);
      setDirty(false);
      onSaved();
    } catch (err) {
      console.error('Failed to save retirement lifestyle:', err);
      alert('Failed to save. Check console.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Retirement Lifestyle</h3>
          <p className="text-sm text-gray-500">Define what you want — we&apos;ll calculate what your trajectory supports</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={recalcPredicted}
            disabled={calculating || goalTotal === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
          >
            <Calculator className={`w-3.5 h-3.5 ${calculating ? 'animate-spin' : ''}`} />
            {calculating ? 'Calculating...' : 'Recalculate Predicted'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              saved
                ? 'bg-green-600 text-white'
                : dirty
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {saving ? 'Saving...' : saved ? (<><Check className="w-4 h-4" /> Saved</>) : (<><Save className="w-4 h-4" /> Save</>)}
          </button>
        </div>
      </div>

      {/* Coverage summary */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 text-center">
          <p className="text-xs text-amber-600 font-medium">Goal Lifestyle</p>
          <p className="text-3xl font-bold text-amber-700">{formatMoney(goalTotal)}<span className="text-base font-normal">/mo</span></p>
          <p className="text-xs text-amber-500">{formatMoney(goalTotal * 12)}/yr</p>
        </div>
        <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4 text-center">
          <p className="text-xs text-blue-600 font-medium">Predicted Lifestyle</p>
          <p className="text-3xl font-bold text-blue-700">{formatMoney(predictedTotal)}<span className="text-base font-normal">/mo</span></p>
          <p className="text-xs text-blue-500">
            {sustainableMonthly !== null
              ? `Based on ${formatMoney(sustainableMonthly)}/mo sustainable withdrawal`
              : `${formatMoney(predictedTotal * 12)}/yr`}
          </p>
        </div>
        <div className={`border-2 rounded-xl p-4 text-center ${
          coveragePct >= 90 ? 'bg-green-50 border-green-300' :
          coveragePct >= 70 ? 'bg-yellow-50 border-yellow-300' :
          'bg-red-50 border-red-300'
        }`}>
          <p className="text-xs text-gray-600 font-medium">Coverage</p>
          <p className={`text-3xl font-bold ${
            coveragePct >= 90 ? 'text-green-700' :
            coveragePct >= 70 ? 'text-yellow-700' :
            'text-red-700'
          }`}>{coveragePct}%</p>
          <p className="text-xs text-gray-500">of goal covered</p>
        </div>
      </div>

      {/* Explanation of how predicted is calculated */}
      {sustainableMonthly !== null && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-600">
            <strong>How predicted is calculated:</strong> Based on your Monte Carlo projection, your median
            net worth at age {profile.retirement_target_age} is approximately{' '}
            <strong>{formatMoney((sustainableMonthly * 12) / (profile.safe_withdrawal_rate || 0.04))}</strong>.
            At a {((profile.safe_withdrawal_rate || 0.04) * 100).toFixed(0)}% safe withdrawal rate, that
            supports <strong>{formatMoney(sustainableMonthly)}/mo</strong> in retirement. Your goal
            categories are scaled proportionally to fit this budget.
            {predictedOverridden && (
              <span className="text-blue-600"> (You&apos;ve manually adjusted some values.)</span>
            )}
          </p>
        </div>
      )}

      {/* Cost of living reality check */}
      <CostOfLivingCheck monthlyBudget={predictedTotal} />

      {/* Side-by-side category editor */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_180px_180px_80px] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase">Category</p>
          <p className="text-xs font-semibold text-amber-600 uppercase text-center">Goal</p>
          <p className="text-xs font-semibold text-blue-600 uppercase text-center">Predicted (auto)</p>
          <p className="text-xs font-semibold text-gray-500 uppercase text-center">Gap</p>
        </div>

        {/* Category rows */}
        {CATEGORIES.map(({ key, label, icon: Icon, period }) => {
          const goalVal = goal[key] as number;
          const predVal = predicted[key] as number;
          const goalMonthly = period === 'yr' ? goalVal / 12 : goalVal;
          const predMonthly = period === 'yr' ? predVal / 12 : predVal;
          const gap = goalMonthly > 0 ? Math.round((predMonthly / goalMonthly) * 100) : predMonthly > 0 ? 100 : 0;

          return (
            <div key={key} className="grid grid-cols-[1fr_180px_180px_80px] gap-4 px-6 py-3 border-b border-gray-100 items-center">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700">{label}</span>
                {period === 'yr' && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">/year</span>}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 text-sm">$</span>
                <input
                  type="number"
                  value={goalVal}
                  onChange={(e) => updateGoal(key, Number(e.target.value))}
                  className="w-full border border-amber-200 bg-amber-50/50 rounded-lg pl-7 pr-3 py-1.5 text-sm text-right focus:ring-amber-400 focus:border-amber-400"
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 text-sm">$</span>
                <input
                  type="number"
                  value={predVal}
                  onChange={(e) => updatePredicted(key, Number(e.target.value))}
                  className="w-full border border-blue-200 bg-blue-50/50 rounded-lg pl-7 pr-3 py-1.5 text-sm text-right focus:ring-blue-400 focus:border-blue-400"
                />
              </div>
              <div className="text-center">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  gap >= 90 ? 'bg-green-100 text-green-700' :
                  gap >= 70 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {gap}%
                </span>
              </div>
            </div>
          );
        })}

        {/* Totals row */}
        <div className="grid grid-cols-[1fr_180px_180px_80px] gap-4 px-6 py-3 bg-gray-50 font-semibold items-center">
          <span className="text-sm text-gray-700">Total Monthly</span>
          <span className="text-sm text-amber-700 text-right pr-3">{formatMoney(goalTotal)}</span>
          <span className="text-sm text-blue-700 text-right pr-3">{formatMoney(predictedTotal)}</span>
          <div className="text-center">
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
              coveragePct >= 90 ? 'bg-green-100 text-green-700' :
              coveragePct >= 70 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {coveragePct}%
            </span>
          </div>
        </div>
      </div>

      {/* FIRE target explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-700">
          <strong>How this connects to FIRE:</strong> Your goal lifestyle of {formatMoney(goalTotal)}/mo
          requires {formatMoney(goalTotal * 12 * 25)} invested (25x annual spending) to retire.
          Your predicted lifestyle of {formatMoney(predictedTotal)}/mo requires {formatMoney(predictedTotal * 12 * 25)}.
          Check the FIRE Projections tab to see when you&apos;ll hit each target.
        </p>
      </div>

      {dirty && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
          <p className="text-sm text-amber-700">
            Unsaved changes. Click <strong>Save</strong> to update your FIRE projections.
          </p>
        </div>
      )}
    </div>
  );
}
