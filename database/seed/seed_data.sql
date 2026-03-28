-- CoastLine Seed Data
-- Run this AFTER 001_create_tables.sql in Supabase SQL Editor

-- Clear existing sample data (idempotent)
DELETE FROM retirement_lifestyles WHERE profile_id IN (SELECT id FROM profiles WHERE is_sample = true);
DELETE FROM assets WHERE profile_id IN (SELECT id FROM profiles WHERE is_sample = true);
DELETE FROM debts WHERE profile_id IN (SELECT id FROM profiles WHERE is_sample = true);
DELETE FROM expenses WHERE profile_id IN (SELECT id FROM profiles WHERE is_sample = true);
DELETE FROM profiles WHERE is_sample = true;

-- ============================================
-- ALEX — High Debt / Entry Level
-- Marketing coordinator, slow salary growth, deficit at start
-- Score 0, only Coast FIRE achievable (age 45)
-- Lean/Barista/Fat FIRE all N/A — NW peaks ~440k@65, runs out by 90
-- Story: "you can accumulate a bit, but it's nowhere near enough to retire"
-- ============================================
INSERT INTO profiles (id, name, slug, is_sample, current_age, career_path, career_level_index, annual_salary, monthly_take_home, employer_match_pct, retirement_target_age, desired_monthly_retirement_income, safe_withdrawal_rate, salary_progression)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Alex', 'alex', true, 24, 'consultant', 0, 42000, 2520, 0, 80, 5000, 0.04,
  '[{"age": 24, "salary": 42000, "label": "Marketing Coordinator"},
    {"age": 28, "salary": 48000, "label": "Sr. Coordinator"},
    {"age": 33, "salary": 55000, "label": "Marketing Manager"},
    {"age": 40, "salary": 65000, "label": "Sr. Marketing Manager"},
    {"age": 50, "salary": 72000, "label": "Director of Marketing"}]'::jsonb
);

-- Alex's expenses (total $2,100 + debt $682 = $2,782 on $2,520 take-home = -$262 deficit)
-- Deep enough deficit at start that accumulation is slow, peaks modest, fades by 90
INSERT INTO expenses (profile_id, category, label, amount) VALUES
  ('11111111-1111-1111-1111-111111111111', 'rent', 'Rent', 1000),
  ('11111111-1111-1111-1111-111111111111', 'car_payment', 'Car Payment', 300),
  ('11111111-1111-1111-1111-111111111111', 'groceries', 'Groceries', 320),
  ('11111111-1111-1111-1111-111111111111', 'dining', 'Dining Out', 120),
  ('11111111-1111-1111-1111-111111111111', 'subscriptions', 'Subscriptions', 40),
  ('11111111-1111-1111-1111-111111111111', 'utilities', 'Utilities', 150),
  ('11111111-1111-1111-1111-111111111111', 'insurance', 'Insurance', 170);

-- Alex's debts (high-APR credit cards + student loans)
INSERT INTO debts (profile_id, name, balance, apr, min_payment) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Student Loans', 45000, 5.5, 450),
  ('11111111-1111-1111-1111-111111111111', 'Credit Card #1', 8200, 24.99, 164),
  ('11111111-1111-1111-1111-111111111111', 'Credit Card #2', 3400, 29.99, 68);

-- Alex's assets (almost nothing)
INSERT INTO assets (profile_id, type, balance) VALUES
  ('11111111-1111-1111-1111-111111111111', 'savings', 1200);

-- ============================================
-- JORDAN — Average / Early Career
-- Consultant with moderate growth, positive surplus
-- Coast FIRE ~43, Lean ~48, Fat ~58
-- ============================================
INSERT INTO profiles (id, name, slug, is_sample, current_age, career_path, career_level_index, annual_salary, monthly_take_home, employer_match_pct, retirement_target_age, desired_monthly_retirement_income, safe_withdrawal_rate, salary_progression)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'Jordan', 'jordan', true, 28, 'consultant', 1, 75000, 4800, 4, 55, 5000, 0.04,
  '[{"age": 28, "salary": 75000, "label": "Consultant"},
    {"age": 33, "salary": 95000, "label": "Senior Consultant"},
    {"age": 38, "salary": 120000, "label": "Manager"},
    {"age": 44, "salary": 145000, "label": "Senior Manager"}]'::jsonb
);

-- Jordan's expenses (total $2,700 + debt $450 = $3,150 on $4,800 = +$580 surplus after 401k)
INSERT INTO expenses (profile_id, category, label, amount) VALUES
  ('22222222-2222-2222-2222-222222222222', 'rent', 'Rent', 1500),
  ('22222222-2222-2222-2222-222222222222', 'car_payment', 'Car Payment', 320),
  ('22222222-2222-2222-2222-222222222222', 'groceries', 'Groceries', 350),
  ('22222222-2222-2222-2222-222222222222', 'dining', 'Dining Out', 200),
  ('22222222-2222-2222-2222-222222222222', 'subscriptions', 'Subscriptions', 50),
  ('22222222-2222-2222-2222-222222222222', 'utilities', 'Utilities', 120),
  ('22222222-2222-2222-2222-222222222222', 'insurance', 'Insurance', 160);

-- Jordan's debts
INSERT INTO debts (profile_id, name, balance, apr, min_payment) VALUES
  ('22222222-2222-2222-2222-222222222222', 'Student Loans', 22000, 4.5, 450);

-- Jordan's assets (decent start)
INSERT INTO assets (profile_id, type, balance) VALUES
  ('22222222-2222-2222-2222-222222222222', '401k', 18000),
  ('22222222-2222-2222-2222-222222222222', 'roth_ira', 6500),
  ('22222222-2222-2222-2222-222222222222', 'savings', 8000);

-- ============================================
-- MORGAN — High Earner / Mid-Career
-- Senior SWE with strong trajectory
-- Coast FIRE ~38, Lean ~42, Fat ~52
-- ============================================
INSERT INTO profiles (id, name, slug, is_sample, current_age, career_path, career_level_index, annual_salary, monthly_take_home, employer_match_pct, retirement_target_age, desired_monthly_retirement_income, safe_withdrawal_rate, salary_progression)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  'Morgan', 'morgan', true, 35, 'swe', 2, 195000, 10200, 4, 55, 8000, 0.04,
  '[{"age": 35, "salary": 195000, "label": "Senior SWE"},
    {"age": 40, "salary": 230000, "label": "Staff SWE"},
    {"age": 47, "salary": 280000, "label": "Principal SWE"}]'::jsonb
);

-- Morgan's expenses (total $4,800 + debt $200 = $5,000 on $10,200 = ~$3,500 surplus after 401k)
INSERT INTO expenses (profile_id, category, label, amount) VALUES
  ('33333333-3333-3333-3333-333333333333', 'rent', 'Rent', 2800),
  ('33333333-3333-3333-3333-333333333333', 'car_payment', 'Car Payment', 550),
  ('33333333-3333-3333-3333-333333333333', 'groceries', 'Groceries', 500),
  ('33333333-3333-3333-3333-333333333333', 'dining', 'Dining Out', 400),
  ('33333333-3333-3333-3333-333333333333', 'subscriptions', 'Subscriptions', 100),
  ('33333333-3333-3333-3333-333333333333', 'utilities', 'Utilities', 200),
  ('33333333-3333-3333-3333-333333333333', 'insurance', 'Insurance', 250);

-- Morgan's debts (almost paid off)
INSERT INTO debts (profile_id, name, balance, apr, min_payment) VALUES
  ('33333333-3333-3333-3333-333333333333', 'Student Loans', 8000, 3.5, 200);

-- Morgan's assets (strong portfolio)
INSERT INTO assets (profile_id, type, balance) VALUES
  ('33333333-3333-3333-3333-333333333333', '401k', 142000),
  ('33333333-3333-3333-3333-333333333333', 'roth_ira', 35000),
  ('33333333-3333-3333-3333-333333333333', 'brokerage', 52000),
  ('33333333-3333-3333-3333-333333333333', 'savings', 25000);

-- ============================================
-- RETIREMENT LIFESTYLES
-- Goal = what they want; Predicted = what trajectory supports
-- ============================================

-- Alex — goal (~$4,100/mo)
INSERT INTO retirement_lifestyles (profile_id, lifestyle_type, housing_monthly, food_monthly, healthcare_monthly, travel_annual, leisure_monthly, transportation_monthly, utilities_monthly, other_monthly)
VALUES ('11111111-1111-1111-1111-111111111111', 'goal', 2000, 600, 400, 3000, 200, 300, 150, 200);

-- Alex — predicted (~$2,520/mo, ~60% of goal)
INSERT INTO retirement_lifestyles (profile_id, lifestyle_type, housing_monthly, food_monthly, healthcare_monthly, travel_annual, leisure_monthly, transportation_monthly, utilities_monthly, other_monthly)
VALUES ('11111111-1111-1111-1111-111111111111', 'predicted', 1200, 400, 300, 1200, 100, 200, 120, 100);

-- Jordan — goal (~$5,647/mo)
INSERT INTO retirement_lifestyles (profile_id, lifestyle_type, housing_monthly, food_monthly, healthcare_monthly, travel_annual, leisure_monthly, transportation_monthly, utilities_monthly, other_monthly)
VALUES ('22222222-2222-2222-2222-222222222222', 'goal', 2500, 800, 500, 8000, 400, 350, 180, 250);

-- Jordan — predicted (~$4,417/mo, ~80% of goal)
INSERT INTO retirement_lifestyles (profile_id, lifestyle_type, housing_monthly, food_monthly, healthcare_monthly, travel_annual, leisure_monthly, transportation_monthly, utilities_monthly, other_monthly)
VALUES ('22222222-2222-2222-2222-222222222222', 'predicted', 2000, 650, 400, 5000, 300, 300, 150, 200);

-- Morgan — goal (~$8,800/mo)
INSERT INTO retirement_lifestyles (profile_id, lifestyle_type, housing_monthly, food_monthly, healthcare_monthly, travel_annual, leisure_monthly, transportation_monthly, utilities_monthly, other_monthly)
VALUES ('33333333-3333-3333-3333-333333333333', 'goal', 4000, 1000, 600, 15000, 800, 500, 250, 400);

-- Morgan — predicted (~$7,670/mo, ~90% of goal)
INSERT INTO retirement_lifestyles (profile_id, lifestyle_type, housing_monthly, food_monthly, healthcare_monthly, travel_annual, leisure_monthly, transportation_monthly, utilities_monthly, other_monthly)
VALUES ('33333333-3333-3333-3333-333333333333', 'predicted', 3500, 900, 550, 12000, 700, 450, 220, 350);
