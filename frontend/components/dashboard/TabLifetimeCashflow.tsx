'use client';

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { FullProfile, LifetimeCashflowPoint } from '@/lib/types';
import { lifestyleTotalMonthly } from '@/lib/types';

interface Props {
  data: FullProfile;
}

const formatDollar = (value: number) => {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

function stepWithRaise(
  pts: { age: number; salary: number }[],
  age: number,
  raisePct = 0.03
): number {
  if (pts.length === 0) return 0;
  if (age < pts[0].age) return pts[0].salary;
  let base = pts[0];
  for (let i = pts.length - 1; i >= 0; i--) {
    if (age >= pts[i].age) {
      base = pts[i];
      break;
    }
  }
  const yearsInLevel = age - base.age;
  return Math.round(base.salary * Math.pow(1 + raisePct, yearsInLevel));
}

function computeCashflow(data: FullProfile): LifetimeCashflowPoint[] {
  const { profile, expenses, debts, assets, retirementLifestyles } = data;

  const currentAge = profile.current_age;
  const retirementAge = profile.retirement_target_age;
  const endAge = 95;
  const inflationRate = 0.02;

  const salaryPts: { age: number; salary: number }[] =
    profile.salary_progression && profile.salary_progression.length > 0
      ? [...profile.salary_progression].sort((a, b) => a.age - b.age)
      : [{ age: currentAge, salary: profile.annual_salary }];

  // Monthly figures
  const monthlyExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Retirement spending from lifestyle data
  const goalMonthly = retirementLifestyles?.goal && lifestyleTotalMonthly(retirementLifestyles.goal) > 0
    ? lifestyleTotalMonthly(retirementLifestyles.goal)
    : monthlyExpenses; // fallback to current expenses, NOT desired_monthly_retirement_income

  const predictedMonthly = retirementLifestyles?.predicted && lifestyleTotalMonthly(retirementLifestyles.predicted) > 0
    ? lifestyleTotalMonthly(retirementLifestyles.predicted)
    : goalMonthly * 0.7;

  const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
  const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);
  const startingNetWorth = totalAssets - totalDebt;

  const debtBalances: Record<string, number> = {};
  debts.forEach((d) => { debtBalances[d.id] = d.balance; });

  // Use a conservative nominal return. 7% is the MC mean but produces infinite
  // growth for well-funded profiles. 5% (~3% real after inflation) gives a
  // more honest picture and allows portfolios to deplete when spending is high.
  const INVESTMENT_RETURN = 0.05;

  const points: LifetimeCashflowPoint[] = [];
  let cumulativeSavings = startingNetWorth;

  for (let age = currentAge; age <= endAge; age++) {
    const isRetired = age >= retirementAge;
    const yearsFromNow = age - currentAge;
    const inflationFactor = Math.pow(1 + inflationRate, yearsFromNow);

    const grossIncome = isRetired ? 0 : stepWithRaise(salaryPts, age);
    const takeHome = grossIncome * 0.72;
    const employerMatch = grossIncome * (profile.employer_match_pct / 100);

    // In retirement, spend whichever is LARGER: lifestyle target OR the
    // SWR-implied draw (portfolio * SWR / 12). This prevents the portfolio
    // from growing forever when someone is under-spending relative to their wealth.
    const swr = profile.safe_withdrawal_rate > 0 ? profile.safe_withdrawal_rate : 0.04;
    const swrMonthlyDraw = isRetired ? (cumulativeSavings * swr) / 12 : 0;
    const baseRetirementSpend = Math.max(predictedMonthly, swrMonthlyDraw);

    const currentSpending = isRetired ? baseRetirementSpend * inflationFactor : monthlyExpenses * inflationFactor;
    const goalSpend = isRetired ? Math.max(goalMonthly, swrMonthlyDraw) * inflationFactor : monthlyExpenses * inflationFactor;
    const predictedSpend = isRetired ? baseRetirementSpend * inflationFactor : monthlyExpenses * inflationFactor;

    // Debt payments (monthly) only during working years
    let debtPayments = 0;
    if (!isRetired) {
      debts.forEach((d) => {
        const remaining = debtBalances[d.id] ?? 0;
        if (remaining > 0) {
          debtPayments += d.min_payment;
          const annualPrincipalPaid = d.min_payment * 12 * 0.6;
          debtBalances[d.id] = Math.max(0, remaining - annualPrincipalPaid);
        }
      });
    }

    // Net savings (monthly) — using predicted spending for cumulative calc
    const monthlyTakeHome = takeHome / 12;
    const monthlyMatch = employerMatch / 12;
    const netSavings = monthlyTakeHome + monthlyMatch - currentSpending - debtPayments;

    // Apply investment return on positive portfolio, then add annual net flow
    const investmentGrowth = cumulativeSavings > 0 ? cumulativeSavings * INVESTMENT_RETURN : 0;
    cumulativeSavings += investmentGrowth + netSavings * 12;

    points.push({
      age,
      grossIncome: grossIncome / 12, // store as monthly
      takeHome: monthlyTakeHome,
      employerMatch: monthlyMatch,
      spending: currentSpending,
      goalSpending: goalSpend,
      predictedSpending: predictedSpend,
      debtPayments,
      netSavings,
      cumulativeSavings,
      isRetired,
    });
  }

  return points;
}

export default function TabLifetimeCashflow({ data }: Props) {
  const { profile, retirementLifestyles } = data;
  const points = computeCashflow(data);

  const workingPoints = points.filter((p) => !p.isRetired);
  const peakPoint = workingPoints.reduce(
    (best, p) => (p.grossIncome > best.grossIncome ? p : best),
    workingPoints[0] ?? points[0]
  );
  const totalNetSavings = workingPoints.reduce((sum, p) => sum + p.netSavings * 12, 0);
  const totalTakeHome = workingPoints.reduce((sum, p) => sum + p.takeHome * 12, 0);
  const avgSavingsRate = totalTakeHome > 0 ? (totalNetSavings / totalTakeHome) * 100 : 0;

  // Build chart data
  const chartData = points.map((p) => ({
    age: p.age,
    takeHome: Math.round(p.takeHome),
    goalSpending: Math.round(p.goalSpending),
    predictedSpending: Math.round(p.predictedSpending),
    debtPayments: Math.round(p.debtPayments),
    grossIncome: Math.round(p.grossIncome),
    cumulativeSavings: Math.round(p.cumulativeSavings),
    isRetired: p.isRetired,
  }));

  // FIRE targets for reference lines
  const goalMonthly = retirementLifestyles?.goal && lifestyleTotalMonthly(retirementLifestyles.goal) > 0
    ? lifestyleTotalMonthly(retirementLifestyles.goal)
    : profile.desired_monthly_retirement_income || 5000;
  const predictedMonthly = retirementLifestyles?.predicted && lifestyleTotalMonthly(retirementLifestyles.predicted) > 0
    ? lifestyleTotalMonthly(retirementLifestyles.predicted)
    : goalMonthly * 0.7;
  const goalFireTarget = 25 * goalMonthly * 12;
  const predictedFireTarget = 25 * predictedMonthly * 12;

  const maxCumulative = Math.max(...chartData.map(d => d.cumulativeSavings), 0);
  const minCumulative = Math.min(...chartData.map(d => d.cumulativeSavings), 0);

  // Determine source label
  const hasGoal = retirementLifestyles?.goal && lifestyleTotalMonthly(retirementLifestyles.goal) > 0;
  const hasPredicted = retirementLifestyles?.predicted && lifestyleTotalMonthly(retirementLifestyles.predicted) > 0;

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500">Peak Monthly Gross</p>
          <p className="text-2xl font-bold text-blue-600">
            ${Math.round(peakPoint?.grossIncome ?? 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400">Age {peakPoint?.age ?? '—'}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500">Total Net Savings (Working)</p>
          <p className={`text-2xl font-bold ${totalNetSavings >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {formatDollar(totalNetSavings)}
          </p>
          <p className="text-xs text-gray-400">Ages {profile.current_age}–{profile.retirement_target_age}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500">Avg Savings Rate</p>
          <p className={`text-2xl font-bold ${avgSavingsRate >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
            {avgSavingsRate.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-400">of take-home pay</p>
        </div>
      </div>

      {/* Source info */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
        <p className="text-xs text-gray-500">
          Post-retirement spending from{' '}
          {hasPredicted
            ? <strong className="text-blue-600">predicted lifestyle (${Math.round(lifestyleTotalMonthly(retirementLifestyles!.predicted!)).toLocaleString()}/mo)</strong>
            : hasGoal
            ? <strong className="text-amber-600">goal lifestyle (${Math.round(lifestyleTotalMonthly(retirementLifestyles!.goal!)).toLocaleString()}/mo)</strong>
            : <strong className="text-gray-600">current expenses (${Math.round(data.expenses.reduce((s, e) => s + e.amount, 0)).toLocaleString()}/mo)</strong>
          }
          {' — both goal and predicted shown as dashed lines after retirement'}
        </p>
      </div>

      {/* Inflation notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
        <span className="text-amber-500 text-sm mt-0.5">*</span>
        <p className="text-xs text-amber-700">
          <strong>Inflation-adjusted values:</strong> All spending and income figures are adjusted for 2% annual inflation.
          A $2,000/mo expense today becomes ~$3,600/mo in 30 years in nominal terms. This reflects the real purchasing
          power needed to maintain your lifestyle over time.
        </p>
      </div>

      {/* Combined chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">
          Lifetime Financial Overview
        </h3>
        {/* Axis legend */}
        <div className="flex items-center gap-4 mb-3 text-[11px]">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500" />
            <span className="text-blue-700 font-medium">Left axis</span>
            <span className="text-gray-400">— Monthly income & spending</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            <span className="text-emerald-700 font-medium">Right axis</span>
            <span className="text-gray-400">— Cumulative net worth</span>
          </span>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="age"
              tick={{ fontSize: 11 }}
              tickLine={false}
              label={{ value: 'Age', position: 'insideBottomRight', offset: -5, fontSize: 11 }}
            />
            {/* Left Y axis: monthly amounts (blue-tinted) */}
            <YAxis
              yAxisId="monthly"
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
              tick={{ fontSize: 11, fill: '#3b82f6' }}
              tickLine={false}
              width={55}
              stroke="#93c5fd"
            />
            {/* Right Y axis: cumulative net worth (green-tinted) */}
            <YAxis
              yAxisId="cumulative"
              orientation="right"
              tickFormatter={formatDollar}
              tick={{ fontSize: 11, fill: '#10b981' }}
              tickLine={false}
              width={60}
              stroke="#6ee7b7"
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name.includes('right axis')) return [formatDollar(value), 'Net Worth'];
                return [`$${Math.round(value).toLocaleString()}/mo`, name];
              }}
              labelFormatter={(age) => `Age ${age}`}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />

            {/* Take-home income area (left axis) */}
            <Area
              yAxisId="monthly"
              type="monotone"
              dataKey="takeHome"
              name="Take-Home"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.15}
              strokeWidth={1.5}
            />

            {/* Goal spending line — dashed amber (left axis) */}
            <Line
              yAxisId="monthly"
              type="monotone"
              dataKey="goalSpending"
              name="Goal Spending"
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
            />

            {/* Predicted spending line — solid blue (left axis) */}
            <Line
              yAxisId="monthly"
              type="monotone"
              dataKey="predictedSpending"
              name="Predicted Spending"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
            />

            {/* Debt payments area (left axis) */}
            <Area
              yAxisId="monthly"
              type="monotone"
              dataKey="debtPayments"
              name="Debt Payments"
              stroke="#ef4444"
              fill="#ef4444"
              fillOpacity={0.2}
              strokeWidth={1.5}
            />

            {/* Cumulative net worth line (right axis) — thick and distinct */}
            <Line
              yAxisId="cumulative"
              type="monotone"
              dataKey="cumulativeSavings"
              name="Net Worth (right axis)"
              stroke="#10b981"
              strokeWidth={3}
              dot={false}
            />

            {/* FIRE target reference lines (right axis) */}
            {goalFireTarget > 0 && goalFireTarget < maxCumulative * 2.5 && (
              <ReferenceLine
                yAxisId="cumulative"
                y={goalFireTarget}
                stroke="#f59e0b"
                strokeDasharray="5 5"
                label={{ value: 'Goal FIRE', position: 'insideTopRight', fontSize: 10, fill: '#b45309' }}
              />
            )}
            {predictedFireTarget > 0 && predictedFireTarget < maxCumulative * 2.5 && (
              <ReferenceLine
                yAxisId="cumulative"
                y={predictedFireTarget}
                stroke="#2563eb"
                strokeDasharray="5 5"
                label={{ value: 'Predicted FIRE', position: 'insideTopRight', fontSize: 10, fill: '#1d4ed8' }}
              />
            )}

            {/* Retirement age marker */}
            <ReferenceLine
              yAxisId="monthly"
              x={profile.retirement_target_age}
              stroke="#6b7280"
              strokeDasharray="4 4"
              label={{ value: 'Retirement', position: 'top', fontSize: 11, fill: '#6b7280' }}
            />

            {/* Zero line for net worth */}
            {minCumulative < 0 && (
              <ReferenceLine yAxisId="cumulative" y={0} stroke="#9ca3af" strokeWidth={1} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
