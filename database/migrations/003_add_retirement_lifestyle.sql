-- Retirement lifestyle table: stores goal and predicted retirement spending
-- Run this in Supabase SQL Editor after previous migrations

CREATE TABLE IF NOT EXISTS retirement_lifestyles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  lifestyle_type TEXT NOT NULL CHECK (lifestyle_type IN ('goal', 'predicted')),
  housing_monthly NUMERIC DEFAULT 0,
  food_monthly NUMERIC DEFAULT 0,
  healthcare_monthly NUMERIC DEFAULT 0,
  travel_annual NUMERIC DEFAULT 0,
  leisure_monthly NUMERIC DEFAULT 0,
  transportation_monthly NUMERIC DEFAULT 0,
  utilities_monthly NUMERIC DEFAULT 0,
  other_monthly NUMERIC DEFAULT 0,
  UNIQUE(profile_id, lifestyle_type)
);

CREATE INDEX IF NOT EXISTS idx_retirement_lifestyles_profile ON retirement_lifestyles(profile_id);

ALTER TABLE retirement_lifestyles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to retirement_lifestyles" ON retirement_lifestyles FOR ALL USING (true) WITH CHECK (true);
