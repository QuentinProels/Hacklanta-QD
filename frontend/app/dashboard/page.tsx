'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { FullProfile, RetirementLifestyle } from '@/lib/types';
import TabOverview from '@/components/dashboard/TabOverview';
import TabFire from '@/components/dashboard/TabFire';
import TabBudgetDebt from '@/components/dashboard/TabBudgetDebt';
import TabCareerPath from '@/components/dashboard/TabCareerPath';
import TabLifetimeCashflow from '@/components/dashboard/TabLifetimeCashflow';
import TabRetirementLifestyle from '@/components/dashboard/TabRetirementLifestyle';
        
const TABS = ['Overview', 'Career Path', 'Retirement Lifestyle', 'FIRE Projections', 'Lifetime Cashflow', 'Budget & Debt', 'AI Insights'] as const;
type Tab = typeof TABS[number];

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const profileSlug = searchParams.get('profile') || 'alex';
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [data, setData] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    setLoading(true);
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('slug', profileSlug)
      .single();

    if (!profile) {
      setLoading(false);
      return;
    }

    const [{ data: expenses }, { data: debts }, { data: assets }, { data: lifestyles }] = await Promise.all([
      supabase.from('expenses').select('*').eq('profile_id', profile.id),
      supabase.from('debts').select('*').eq('profile_id', profile.id),
      supabase.from('assets').select('*').eq('profile_id', profile.id),
      supabase.from('retirement_lifestyles').select('*').eq('profile_id', profile.id),
    ]);

    const goalLifestyle = (lifestyles || []).find((l: RetirementLifestyle) => l.lifestyle_type === 'goal') || null;
    const predictedLifestyle = (lifestyles || []).find((l: RetirementLifestyle) => l.lifestyle_type === 'predicted') || null;

    setData({
      profile,
      expenses: expenses || [],
      debts: debts || [],
      assets: assets || [],
      retirementLifestyles: { goal: goalLifestyle, predicted: predictedLifestyle },
    });
    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
  }, [profileSlug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400 text-lg">Loading profile...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <p className="text-gray-500">Profile not found.</p>
        <button onClick={() => router.push('/')} className="text-blue-600 hover:underline">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="text-2xl font-bold text-gray-900">
            Coast<span className="text-blue-600">Line</span>
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Viewing:</span>
            <span className="font-semibold text-gray-900">{data.profile.name}</span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
              {data.profile.career_path} · ${data.profile.annual_salary.toLocaleString()}/yr
            </span>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex gap-1 -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Tab Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'Overview' && <TabOverview data={data} />}
        {activeTab === 'Career Path' && <TabCareerPath data={data} onSaved={loadProfile} />}
        {activeTab === 'Lifetime Cashflow' && <TabLifetimeCashflow data={data} />}
        {activeTab === 'Retirement Lifestyle' && <TabRetirementLifestyle data={data} onSaved={loadProfile} />}
        {activeTab === 'FIRE Projections' && <TabFire data={data} />}
        {activeTab === 'Budget & Debt' && <TabBudgetDebt data={data} />}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-gray-400 text-lg">Loading...</div></div>}>
      <DashboardContent />
    </Suspense>
  );
}
