'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import careerPaths from '@/data/career_paths.json';
import type { CareerPaths } from '@/lib/types';
import CareerProgressionChart, { type SalaryPoint } from '@/components/charts/CareerProgressionChart';

const careers = careerPaths as CareerPaths;

// Presets
const EXPENSE_PRESETS = {
  frugal: { label: 'Frugal', rent: 900, car_payment: 0, groceries: 300, dining: 50, subscriptions: 0, utilities: 100, insurance: 120, total: 2200 },
  moderate: { label: 'Moderate', rent: 1400, car_payment: 280, groceries: 350, dining: 150, subscriptions: 40, utilities: 130, insurance: 150, total: 3200 },
  comfortable: { label: 'Comfortable', rent: 2200, car_payment: 450, groceries: 450, dining: 300, subscriptions: 80, utilities: 180, insurance: 200, total: 4800 },
};

const DEBT_PRESETS = {
  low: {
    label: 'Low Debt',
    debts: [{ name: 'Student Loans', balance: 5000, apr: 4.0, min_payment: 100 }],
  },
  medium: {
    label: 'Medium Debt',
    debts: [
      { name: 'Student Loans', balance: 25000, apr: 5.5, min_payment: 350 },
      { name: 'Credit Card', balance: 3000, apr: 22.0, min_payment: 60 },
    ],
  },
  high: {
    label: 'High Debt',
    debts: [
      { name: 'Student Loans', balance: 55000, apr: 6.0, min_payment: 550 },
      { name: 'Credit Card #1', balance: 8000, apr: 24.99, min_payment: 160 },
      { name: 'Credit Card #2', balance: 4000, apr: 29.99, min_payment: 80 },
      { name: 'Car Loan', balance: 18000, apr: 6.9, min_payment: 380 },
    ],
  },
};

const ASSET_PRESETS = {
  starting: {
    label: 'Starting Out',
    assets: { savings: 2000, '401k': 0, roth_ira: 0, brokerage: 0 },
  },
  building: {
    label: 'Building',
    assets: { savings: 5000, '401k': 15000, roth_ira: 5000, brokerage: 0 },
  },
  established: {
    label: 'Established',
    assets: { savings: 15000, '401k': 80000, roth_ira: 25000, brokerage: 20000 },
  },
};

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1: Career
  const [currentAge, setCurrentAge] = useState(25);
  const [ageInput, setAgeInput] = useState('25');
  const [careerKey, setCareerKey] = useState('swe');
  const [levelIndex, setLevelIndex] = useState(0);
  const [salaryPoints, setSalaryPoints] = useState<SalaryPoint[]>([]);

  // Step 2: Budget
  const [expensePreset, setExpensePreset] = useState<'frugal' | 'moderate' | 'comfortable'>('moderate');
  const [expenses, setExpenses] = useState(EXPENSE_PRESETS.moderate);

  // Step 3: Debts
  const [debtPreset, setDebtPreset] = useState<'low' | 'medium' | 'high'>('medium');
  const [debts, setDebts] = useState(DEBT_PRESETS.medium.debts);

  // Step 4: Assets
  const [assetPreset, setAssetPreset] = useState<'starting' | 'building' | 'established'>('building');
  const [assets, setAssets] = useState(ASSET_PRESETS.building.assets);
  const [employerMatch, setEmployerMatch] = useState(4);

  // Step 5: Goals
  const [retirementAge, setRetirementAge] = useState(55);
  const [monthlyRetirementIncome, setMonthlyRetirementIncome] = useState(5000);
  const [swr, setSwr] = useState(0.04);

  const selectedCareer = careers[careerKey];
  const selectedLevel = selectedCareer?.progression[levelIndex];
  const salary = selectedLevel?.median || 0;
  const monthlyTakeHome = Math.round(salary * 0.72 / 12);

  // Build salary progression points from career path starting at user's actual age
  useEffect(() => {
    if (!selectedCareer || !selectedLevel) return;
    const currentLevelStartYears = selectedLevel.years_range[0];
    const pts: SalaryPoint[] = selectedCareer.progression
      .filter((_, i) => i >= levelIndex)
      .map((level) => ({
        age: currentAge + (level.years_range[0] - currentLevelStartYears),
        salary: level.median,
        label: level.level,
      }));
    setSalaryPoints(pts);
  }, [careerKey, levelIndex, currentAge]);

  const handleExpensePreset = (preset: 'frugal' | 'moderate' | 'comfortable') => {
    setExpensePreset(preset);
    setExpenses(EXPENSE_PRESETS[preset]);
  };

  const handleDebtPreset = (preset: 'low' | 'medium' | 'high') => {
    setDebtPreset(preset);
    setDebts(DEBT_PRESETS[preset].debts);
  };

  const handleAssetPreset = (preset: 'starting' | 'building' | 'established') => {
    setAssetPreset(preset);
    setAssets(ASSET_PRESETS[preset].assets);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      // Delete existing interactive profile
      await supabase.from('expenses').delete().eq('profile_id', (await supabase.from('profiles').select('id').eq('slug', 'interactive').single()).data?.id || '');
      await supabase.from('debts').delete().eq('profile_id', (await supabase.from('profiles').select('id').eq('slug', 'interactive').single()).data?.id || '');
      await supabase.from('assets').delete().eq('profile_id', (await supabase.from('profiles').select('id').eq('slug', 'interactive').single()).data?.id || '');
      await supabase.from('profiles').delete().eq('slug', 'interactive');

      // Insert profile
      const { data: profile, error: profileErr } = await supabase.from('profiles').insert({
        name: 'You',
        slug: 'interactive',
        is_sample: false,
        current_age: currentAge,
        career_path: careerKey,
        career_level_index: levelIndex,
        annual_salary: salary,
        monthly_take_home: monthlyTakeHome,
        employer_match_pct: employerMatch,
        retirement_target_age: retirementAge,
        desired_monthly_retirement_income: monthlyRetirementIncome,
        safe_withdrawal_rate: swr,
        salary_progression: salaryPoints.map(({ age, salary, label }) => ({ age, salary, label })),
      }).select().single();

      if (profileErr || !profile) throw profileErr;

      // Insert expenses
      const expenseRows = Object.entries(expenses)
        .filter(([k]) => k !== 'label' && k !== 'total')
        .map(([category, amount]) => ({
          profile_id: profile.id,
          category,
          label: category.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          amount: amount as number,
        }));
      await supabase.from('expenses').insert(expenseRows);

      // Insert debts
      const debtRows = debts.map((d) => ({ profile_id: profile.id, ...d }));
      if (debtRows.length > 0) await supabase.from('debts').insert(debtRows);

      // Insert assets
      const assetRows = Object.entries(assets)
        .filter(([, v]) => v > 0)
        .map(([type, balance]) => ({ profile_id: profile.id, type, balance }));
      if (assetRows.length > 0) await supabase.from('assets').insert(assetRows);

      router.push('/dashboard?profile=interactive');
    } catch (err) {
      console.error('Error saving profile:', err);
      alert('Error saving profile. Check console.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button onClick={() => router.push('/')} className="text-2xl font-bold text-gray-900">
            Coast<span className="text-blue-600">Line</span>
          </button>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} className={`w-8 h-1.5 rounded-full ${s <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* Step 1: Career */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Choose Your Career Path</h2>
            <p className="text-gray-500 mb-6">This determines your salary progression curve.</p>
            <div className="flex items-center gap-4 mb-4">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Your current age</label>
              <input
                type="number"
                value={ageInput}
                onChange={(e) => setAgeInput(e.target.value)}
                onBlur={(e) => {
                  const val = Math.max(16, Math.min(115, Number(e.target.value) || 25));
                  setCurrentAge(val);
                  setAgeInput(String(val));
                }}
                min={16}
                max={115}
                className="w-12 border border-gray-300 rounded-lg px-2 py-0.5 text-center text-base text-gray-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <select
              value={careerKey}
              onChange={(e) => { setCareerKey(e.target.value); setLevelIndex(0); }}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg mb-4"
            >
              {Object.entries(careers).map(([key, career]) => (
                <option key={key} value={key}>{career.label}</option>
              ))}
            </select>
            <select
              value={levelIndex}
              onChange={(e) => setLevelIndex(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg mb-6"
            >
              {selectedCareer?.progression.map((level, i) => (
                <option key={i} value={i}>
                  {level.level} — ${level.salary_range[0].toLocaleString()}–${level.salary_range[1].toLocaleString()} (median ${level.median.toLocaleString()})
                </option>
              ))}
            </select>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-700">
                <strong>Estimated salary:</strong> ${salary.toLocaleString()}/yr &nbsp;|&nbsp;
                <strong>Take-home:</strong> ~${monthlyTakeHome.toLocaleString()}/mo &nbsp;|&nbsp;
                <strong>Graph starts at age:</strong> {currentAge}
              </p>
            </div>

            <CareerProgressionChart
              points={salaryPoints}
              onChange={setSalaryPoints}
              currentAge={currentAge}
            />
          </div>
        )}

        {/* Step 2: Budget */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Monthly Budget</h2>
            <p className="text-gray-500 mb-6">Select a preset, then adjust if needed.</p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {(Object.entries(EXPENSE_PRESETS) as [string, typeof EXPENSE_PRESETS.frugal][]).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => handleExpensePreset(key as any)}
                  className={`p-4 rounded-lg border-2 text-center transition-colors ${
                    expensePreset === key ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <p className="font-semibold capitalize">{key}</p>
                  <p className="text-sm text-gray-500">~${preset.total.toLocaleString()}/mo</p>
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {(['rent', 'car_payment', 'groceries', 'dining', 'subscriptions', 'utilities', 'insurance'] as const).map((cat) => (
                <div key={cat} className="flex items-center gap-3">
                  <label className="w-32 text-sm text-gray-600 capitalize">{cat.replace('_', ' ')}</label>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      value={(expenses as any)[cat]}
                      onChange={(e) => setExpenses({ ...expenses, [cat]: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Debts */}
        {step === 3 && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Your Debts</h2>
            <p className="text-gray-500 mb-6">Select a debt level preset.</p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {(Object.entries(DEBT_PRESETS) as [string, typeof DEBT_PRESETS.low][]).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => handleDebtPreset(key as any)}
                  className={`p-4 rounded-lg border-2 text-center transition-colors ${
                    debtPreset === key ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <p className="font-semibold">{preset.label}</p>
                  <p className="text-sm text-gray-500">{preset.debts.length} item{preset.debts.length > 1 ? 's' : ''}</p>
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {debts.map((debt, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <input
                      value={debt.name}
                      onChange={(e) => { const d = [...debts]; d[i] = { ...d[i], name: e.target.value }; setDebts(d); }}
                      className="font-semibold border-none p-0 focus:ring-0 text-gray-900"
                    />
                    <button onClick={() => setDebts(debts.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Balance</label>
                      <input type="number" value={debt.balance} onChange={(e) => { const d = [...debts]; d[i] = { ...d[i], balance: Number(e.target.value) }; setDebts(d); }} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">APR %</label>
                      <input type="number" step="0.01" value={debt.apr} onChange={(e) => { const d = [...debts]; d[i] = { ...d[i], apr: Number(e.target.value) }; setDebts(d); }} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Min Payment</label>
                      <input type="number" value={debt.min_payment} onChange={(e) => { const d = [...debts]; d[i] = { ...d[i], min_payment: Number(e.target.value) }; setDebts(d); }} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setDebts([...debts, { name: 'New Debt', balance: 0, apr: 0, min_payment: 0 }])}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg py-3 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                + Add Debt
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Assets */}
        {step === 4 && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Your Assets</h2>
            <p className="text-gray-500 mb-6">Select a starting point, then adjust.</p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {(Object.entries(ASSET_PRESETS) as [string, typeof ASSET_PRESETS.starting][]).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => handleAssetPreset(key as any)}
                  className={`p-4 rounded-lg border-2 text-center transition-colors ${
                    assetPreset === key ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <p className="font-semibold">{preset.label}</p>
                </button>
              ))}
            </div>
            <div className="space-y-3 mb-6">
              {Object.entries(assets).map(([type, balance]) => (
                <div key={type} className="flex items-center gap-3">
                  <label className="w-32 text-sm text-gray-600 capitalize">{type.replace('_', ' ')}</label>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      value={balance}
                      onChange={(e) => setAssets({ ...assets, [type]: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <label className="w-32 text-sm text-gray-600">401k Match %</label>
              <input
                type="number"
                value={employerMatch}
                onChange={(e) => setEmployerMatch(Number(e.target.value))}
                min={0}
                max={10}
                className="w-24 border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>
        )}

        {/* Step 5: Goals */}
        {step === 5 && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Retirement Goals</h2>
            <p className="text-gray-500 mb-6">Set your targets.</p>

            <div className="space-y-8">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  When do you want to retire? <span className="font-bold text-blue-600">{retirementAge}</span>
                </label>
                <input
                  type="range"
                  min={35}
                  max={70}
                  value={retirementAge}
                  onChange={(e) => setRetirementAge(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-400"><span>35</span><span>70</span></div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Desired monthly retirement income: <span className="font-bold text-blue-600">${monthlyRetirementIncome.toLocaleString()}</span>
                </label>
                <input
                  type="range"
                  min={2000}
                  max={15000}
                  step={500}
                  value={monthlyRetirementIncome}
                  onChange={(e) => setMonthlyRetirementIncome(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-400"><span>$2,000</span><span>$15,000</span></div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Safe Withdrawal Rate</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { val: 0.035, label: '3.5%', desc: 'Conservative' },
                    { val: 0.04, label: '4%', desc: 'Recommended' },
                    { val: 0.045, label: '4.5%', desc: 'Aggressive' },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => setSwr(opt.val)}
                      className={`p-3 rounded-lg border-2 text-center transition-colors ${
                        swr === opt.val ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <p className="font-semibold">{opt.label}</p>
                      <p className="text-xs text-gray-500">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-10">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : router.push('/')}
            className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 5 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-8 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'See My Plan'}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
