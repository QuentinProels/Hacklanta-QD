'use client';

import {
  ComposedChart,
  LineChart,
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

interface Props {
  data: FullProfile;
}

const formatDollar = (value: number) => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const formatDollarFull = (value: number) => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
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
  const { profile, expenses, debts, assets } = data;

  const currentAge = profile.current_age;
  const retirementAge = profile.retirement_target_age;
  const endAge = 85;

  const salaryPts: { age: number; salary: number }[] =
    profile.salary_progression && profile.salary_progression.length > 0
      ? [...profile.salary_progression].sort((a, b) => a.age - b.age)
      : [{ age: currentAge, salary: profile.annual_salary }];

  const monthlyExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const annualExpensesBase = monthlyExpenses * 12;

  const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
  const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);
  const startingNetWorth = totalAssets - totalDebt;

  // Track remaining debt balances (keyed by debt id)
  const debtBalances: Record<string, number> = {};
  debts.forEach((d) => {
    debtBalances[d.id] = d.balance;
  });

  const points: LifetimeCashflowPoint[] = [];
  let cumulativeSavings = startingNetWorth;

  for (let age = currentAge; age <= endAge; age++) {
    const isRetired = age >= retirementAge;
    const yearsFromNow = age - currentAge;
    const inflationFactor = Math.pow(1.02, yearsFromNow);

    let grossIncome: number;
    if (isRetired) {
      grossIncome = 0;
    } else {
      grossIncome = stepWithRaise(salaryPts, age);
    }

    const takeHome = grossIncome * 0.72;
    const employerMatch = grossIncome * (profile.employer_match_pct / 100);

    let spending: number;
    if (isRetired) {
      spending = profile.desired_monthly_retirement_income * 12 * inflationFactor;
    } else {
      spending = annualExpensesBase * inflationFactor;
    }

    // Debt payments: sum min payments, reduce balances by 60% principal per year until gone
    let debtPayments = 0;
    if (!isRetired) {
      debts.forEach((d) => {
        const remaining = debtBalances[d.id] ?? 0;
        if (remaining > 0) {
          const annualMin = d.min_payment * 12;
          debtPayments += annualMin;
          // Reduce balance by 60% of annual payment as principal
          const principalPaid = annualMin * 0.6;
          debtBalances[d.id] = Math.max(0, remaining - principalPaid);
        }
      });
    }

    const netSavings = takeHome + employerMatch - spending - debtPayments;
    cumulativeSavings += netSavings;

    points.push({
      age,
      grossIncome,
      takeHome,
      employerMatch,
      spending,
      debtPayments,
      netSavings,
      cumulativeSavings,
      isRetired,
    });
  }

  return points;
}

export default function TabLifetimeCashflow({ data }: Props) {
  const { profile } = data;
  const points = computeCashflow(data);

  // Stat computations
  const workingPoints = points.filter((p) => !p.isRetired);
  const peakPoint = workingPoints.reduce(
    (best, p) => (p.grossIncome > best.grossIncome ? p : best),
    workingPoints[0] ?? points[0]
  );
  const totalNetSavings = workingPoints.reduce((sum, p) => sum + p.netSavings, 0);
  const totalTakeHome = workingPoints.reduce((sum, p) => sum + p.takeHome, 0);
  const avgSavingsRate =
    totalTakeHome > 0 ? (totalNetSavings / totalTakeHome) * 100 : 0;

  const fatFireTarget =
    (profile.desired_monthly_retirement_income * 12) / profile.safe_withdrawal_rate;

  // Build chart data with green/red coloring info for cumulative line
  const chartData = points.map((p) => ({
    ...p,
    cumulativeSavingsPositive: p.cumulativeSavings >= 0 ? p.cumulativeSavings : null,
    cumulativeSavingsNegative: p.cumulativeSavings < 0 ? p.cumulativeSavings : null,
  }));

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500">Peak Annual Gross Income</p>
          <p className="text-2xl font-bold text-blue-600">
            {formatDollarFull(peakPoint?.grossIncome ?? 0)}
          </p>
          <p className="text-xs text-gray-400">Age {peakPoint?.age ?? '—'}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500">Total Net Savings (Working Years)</p>
          <p className={`text-2xl font-bold ${totalNetSavings >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {formatDollarFull(totalNetSavings)}
          </p>
          <p className="text-xs text-gray-400">
            Ages {profile.current_age}–{profile.retirement_target_age}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500">Avg Savings Rate</p>
          <p className={`text-2xl font-bold ${avgSavingsRate >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
            {avgSavingsRate.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-400">of take-home pay</p>
        </div>
      </div>

      {/* Charts card */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-6">
        {/* Top panel: Income vs Spending */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Income vs Spending</h3>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="age"
                tick={{ fontSize: 12 }}
                tickLine={false}
                label={{ value: 'Age', position: 'insideBottomRight', offset: -5, fontSize: 12 }}
              />
              <YAxis
                tickFormatter={formatDollar}
                tick={{ fontSize: 12 }}
                tickLine={false}
                width={62}
              />
              <Tooltip
                formatter={(value: number, name: string) => [formatDollarFull(value), name]}
                labelFormatter={(age) => `Age ${age}`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />

              <Area
                type="monotone"
                dataKey="takeHome"
                name="Take-Home"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.3}
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="spending"
                name="Spending"
                stroke="#f97316"
                fill="#f97316"
                fillOpacity={0.3}
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="debtPayments"
                name="Debt Payments"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.3}
                strokeWidth={1.5}
              />
              <Line
                type="monotone"
                dataKey="grossIncome"
                name="Gross Income"
                stroke="#2563eb"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />

              <ReferenceLine
                x={profile.retirement_target_age}
                stroke="#6b7280"
                strokeDasharray="4 4"
                label={{ value: 'Retirement', position: 'top', fontSize: 11, fill: '#6b7280' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="border-t border-gray-100" />

        {/* Bottom panel: Cumulative Net Worth */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Cumulative Net Worth</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="age"
                tick={{ fontSize: 12 }}
                tickLine={false}
                label={{ value: 'Age', position: 'insideBottomRight', offset: -5, fontSize: 12 }}
              />
              <YAxis
                tickFormatter={formatDollar}
                tick={{ fontSize: 12 }}
                tickLine={false}
                width={62}
              />
              <Tooltip
                formatter={(value: number, name: string) => [formatDollarFull(value), name]}
                labelFormatter={(age) => `Age ${age}`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />

              <Line
                type="monotone"
                dataKey="cumulativeSavingsPositive"
                name="Net Worth"
                stroke="#10b981"
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (payload.age === profile.retirement_target_age) {
                    return (
                      <circle
                        key={`dot-${payload.age}`}
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill="#10b981"
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    );
                  }
                  return <g key={`dot-${payload.age}`} />;
                }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="cumulativeSavingsNegative"
                name="Net Worth (Deficit)"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />

              <ReferenceLine y={0} stroke="#9ca3af" strokeWidth={1} />
              {profile.safe_withdrawal_rate > 0 && isFinite(fatFireTarget) && (
                <ReferenceLine
                  y={fatFireTarget}
                  stroke="#f59e0b"
                  strokeDasharray="5 5"
                  label={{ value: 'Fat FIRE target', position: 'insideTopRight', fontSize: 11, fill: '#f59e0b' }}
                />
              )}
              <ReferenceLine
                x={profile.retirement_target_age}
                stroke="#6b7280"
                strokeDasharray="4 4"
                label={{ value: 'Retirement', position: 'top', fontSize: 11, fill: '#6b7280' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
