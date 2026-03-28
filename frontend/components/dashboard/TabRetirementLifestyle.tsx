'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { FullProfile, RetirementLifestyle } from '@/lib/types';
import { lifestyleTotalMonthly } from '@/lib/types';
import { Save, Check, Home, UtensilsCrossed, HeartPulse, Plane, Music, Car, Zap, MoreHorizontal } from 'lucide-react';

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
  return `$${n.toLocaleString()}`;
}

export default function TabRetirementLifestyle({ data, onSaved }: Props) {
  const { profile } = data;

  const [goal, setGoal] = useState<RetirementLifestyle>(
    data.retirementLifestyles?.goal || { ...EMPTY_LIFESTYLE, lifestyle_type: 'goal' }
  );
  const [predicted, setPredicted] = useState<RetirementLifestyle>(
    data.retirementLifestyles?.predicted || { ...EMPTY_LIFESTYLE, lifestyle_type: 'predicted' }
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setGoal(data.retirementLifestyles?.goal || { ...EMPTY_LIFESTYLE, lifestyle_type: 'goal' });
    setPredicted(data.retirementLifestyles?.predicted || { ...EMPTY_LIFESTYLE, lifestyle_type: 'predicted' });
    setDirty(false);
    setSaved(false);
  }, [profile.id]);

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
    setDirty(true);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upsert goal
      const goalRow = { ...goal, profile_id: profile.id, lifestyle_type: 'goal' as const };
      delete (goalRow as any).id;
      await supabase.from('retirement_lifestyles').upsert(goalRow, {
        onConflict: 'profile_id,lifestyle_type',
      });

      // Upsert predicted
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
          <p className="text-sm text-gray-500">Define what you want vs. what your trajectory supports</p>
        </div>
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
          <p className="text-xs text-blue-500">{formatMoney(predictedTotal * 12)}/yr</p>
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

      {/* Side-by-side category editor */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_180px_180px_80px] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase">Category</p>
          <p className="text-xs font-semibold text-amber-600 uppercase text-center">Goal</p>
          <p className="text-xs font-semibold text-blue-600 uppercase text-center">Predicted</p>
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
          Check the FIRE Projections tab to see when you'll hit each target.
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
