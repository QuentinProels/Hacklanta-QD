'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { FullProfile, CareerPaths } from '@/lib/types';
import CareerProgressionChart, { type SalaryPoint, type BenchmarkLine } from '@/components/charts/CareerProgressionChart';
import { Save, RotateCcw, Check, X } from 'lucide-react';
import careerPaths from '@/data/career_paths.json';

const careers = careerPaths as CareerPaths;

interface Props {
  data: FullProfile;
  onSaved: () => void;
}

export default function TabCareerPath({ data, onSaved }: Props) {
  const { profile } = data;

  // Build initial points: use saved progression, or default to flat (current salary forever)
  const buildInitialPoints = (): SalaryPoint[] => {
    if (profile.salary_progression && profile.salary_progression.length > 0) {
      // Filter to labeled milestones only — interpolated year-by-year points
      // (saved for simulation) should not show as draggable chart bubbles.
      const milestones = profile.salary_progression.filter((sp) => sp.label);
      if (milestones.length > 0) {
        return milestones.map((sp) => ({
          age: sp.age,
          salary: sp.salary,
          label: sp.label || '',
        }));
      }
    }
    // Default: flat salary — just one point at current age
    return [
      { age: profile.current_age, salary: profile.annual_salary, label: 'Current' },
    ];
  };

  const [points, setPoints] = useState<SalaryPoint[]>(buildInitialPoints);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<string[]>([]);
  const [annualRaisePct, setAnnualRaisePct] = useState(3);

  // Reset when profile changes
  useEffect(() => {
    setPoints(buildInitialPoints());
    setDirty(false);
    setSaved(false);
  }, [profile.id]);

  // Build benchmark lines from selected career paths with level labels
  const benchmarkLines: BenchmarkLine[] = selectedBenchmarks.flatMap((key) => {
    const career = careers[key];
    if (!career) return [];
    const data = career.progression.map((level) => ({
      age: profile.current_age + level.years_range[0],
      salary: level.median,
      levelLabel: level.level,
    }));
    return [{ label: career.label, data }];
  });

  const toggleBenchmark = (key: string) => {
    setSelectedBenchmarks((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleChange = (newPoints: SalaryPoint[]) => {
    setPoints(newPoints);
    setDirty(true);
    setSaved(false);
  };

  // Recompute each promotion milestone's salary by compounding from the previous
  // dot + 12% promotion bump. First dot stays anchored.
  const recalcWithRaise = (pts: SalaryPoint[], raisePct: number): SalaryPoint[] => {
    const sorted = [...pts].sort((a, b) => a.age - b.age);
    const raise = raisePct / 100;
    const result: SalaryPoint[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const prev = result[i - 1];
      const yearsBetween = sorted[i].age - prev.age;
      const compounded = Math.round(prev.salary * Math.pow(1 + raise, yearsBetween));
      result.push({ ...sorted[i], salary: Math.round(compounded * 1.12) });
    }
    return result;
  };

  // Bake the annual raise into year-by-year points between milestones so the
  // simulation gets the full compounded curve, not just the milestone dots.
  const bakeRaiseIntoProgression = (pts: SalaryPoint[], raisePct: number) => {
    const sorted = [...pts].sort((a, b) => a.age - b.age);
    const raise = raisePct / 100;
    const result: { age: number; salary: number; label?: string }[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      result.push({ age: current.age, salary: current.salary, label: current.label });
      if (next) {
        for (let age = current.age + 1; age < next.age; age++) {
          const years = age - current.age;
          result.push({ age, salary: Math.round(current.salary * Math.pow(1 + raise, years)) });
        }
      }
    }
    return result;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const progression = bakeRaiseIntoProgression(points, annualRaisePct);

      const { error } = await supabase
        .from('profiles')
        .update({ salary_progression: progression })
        .eq('id', profile.id);

      if (error) throw error;

      setSaved(true);
      setDirty(false);
      onSaved();
    } catch (err) {
      console.error('Failed to save salary progression:', err);
      alert('Failed to save. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPoints(buildInitialPoints());
    setDirty(false);
    setSaved(false);
  };

  const handleResetToFlat = () => {
    setPoints([
      { age: profile.current_age, salary: profile.annual_salary, label: 'Current' },
    ]);
    setDirty(true);
    setSaved(false);
  };

  // Compute some summary stats
  const sorted = [...points].sort((a, b) => a.age - b.age);
  const currentSalary = sorted[0]?.salary || profile.annual_salary;
  const peakSalary = Math.max(...sorted.map((p) => p.salary));
  const peakAge = sorted.find((p) => p.salary === peakSalary)?.age || profile.current_age;

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Salary Progression</h3>
          <p className="text-sm text-gray-500">
            {sorted.length === 1
              ? 'Currently flat — add milestones to model expected raises and promotions'
              : `${sorted.length} milestones from age ${sorted[0]?.age} to ${sorted[sorted.length - 1]?.age}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Undo Changes
            </button>
          )}
          <button
            onClick={handleResetToFlat}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reset to Flat
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
            {saving ? (
              <>Saving...</>
            ) : saved ? (
              <>
                <Check className="w-4 h-4" />
                Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save
              </>
            )}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500">Current Salary</p>
          <p className="text-2xl font-bold text-gray-900">${currentSalary.toLocaleString()}</p>
          <p className="text-xs text-gray-400">Age {sorted[0]?.age || profile.current_age}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500">Peak Salary</p>
          <p className="text-2xl font-bold text-blue-600">${peakSalary.toLocaleString()}</p>
          <p className="text-xs text-gray-400">Age {peakAge}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500">Lifetime Growth</p>
          <p className="text-2xl font-bold text-green-600">
            {currentSalary > 0
              ? `${Math.round(((peakSalary - currentSalary) / currentSalary) * 100)}%`
              : '—'}
          </p>
          <p className="text-xs text-gray-400">
            +${(peakSalary - currentSalary).toLocaleString()}/yr
          </p>
        </div>
      </div>

      {/* Benchmark career path selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-600 mb-3">Compare with example career paths</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(careers).map(([key, career]) => {
            const isSelected = selectedBenchmarks.includes(key);
            return (
              <button
                key={key}
                onClick={() => toggleBenchmark(key)}
                className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                {career.label}
                {isSelected && <X className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Annual raise control */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-600 mb-2">
          Annual raise between milestones: <span className="font-bold text-blue-600">{annualRaisePct}%</span>
        </label>
        <input
          type="range"
          min={0}
          max={10}
          step={0.5}
          value={annualRaisePct}
          onChange={(e) => {
            const pct = Number(e.target.value);
            setAnnualRaisePct(pct);
            setPoints((prev) => recalcWithRaise(prev, pct));
            setDirty(true);
            setSaved(false);
          }}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>0% (flat)</span>
          <span>5%</span>
          <span>10%</span>
        </div>
      </div>

      {/* Interactive chart + table */}
      <CareerProgressionChart
        points={points}
        onChange={handleChange}
        currentAge={profile.current_age}
        benchmarkLines={benchmarkLines}
        annualRaisePct={annualRaisePct}
      />

      {/* Help text */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-700">
          <strong>How to use:</strong> Start with your current salary (flat line). Add milestones for
          expected promotions or job changes. Drag points up/down to adjust salary, or use the table
          below the chart for exact numbers. Click <strong>Save</strong> to update your profile — this
          progression feeds into all FIRE projections and AI insights.
        </p>
      </div>

      {dirty && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
          <p className="text-sm text-amber-700">
            You have unsaved changes. Click <strong>Save</strong> to update your projections.
          </p>
        </div>
      )}
    </div>
  );
}
