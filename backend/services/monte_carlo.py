import numpy as np


def run_simulation(
    current_age: int,
    retirement_target_age: int,
    annual_salary: float,
    salary_progression: list[dict],
    monthly_expenses: float,
    monthly_debt_payments: float,
    total_debt: float,
    current_assets: dict,
    monthly_savings_rate: float,
    employer_match_pct: float,
    safe_withdrawal_rate: float,
    goal_monthly_retirement_income: float,
    predicted_monthly_retirement_income: float,
    num_simulations: int = 1000,
) -> dict:
    """Run Monte Carlo simulation for FIRE projections."""
    max_age = 95
    years = max_age - current_age

    # Market parameters
    mean_return = 0.07
    std_return = 0.15

    # Build salary lookup by age from progression
    salary_by_age = {}
    for i, prog in enumerate(salary_progression):
        if i < len(salary_progression) - 1:
            next_age = salary_progression[i + 1]["age"]
            for a in range(prog["age"], next_age):
                salary_by_age[a] = prog["salary"]
        else:
            for a in range(prog["age"], max_age + 1):
                salary_by_age[a] = prog["salary"]

    # Starting net worth (can be negative if debt exceeds assets)
    total_assets = (
        current_assets.get("retirement_accounts", 0)
        + current_assets.get("taxable", 0)
        + current_assets.get("savings", 0)
    )
    starting_nw = total_assets - total_debt

    # Run simulations
    all_paths = np.zeros((num_simulations, years + 1))
    all_paths[:, 0] = max(starting_nw, 0)

    # Track remaining debt separately — starts at total_debt and decreases
    remaining_debt = total_debt

    # Pre-generate random returns
    returns = np.random.normal(mean_return, std_return, (num_simulations, years))

    # Expenses also grow with inflation
    inflation_rate = 0.02

    for y in range(years):
        age = current_age + y
        salary = salary_by_age.get(age, annual_salary)
        monthly_take_home = salary * 0.72 / 12  # rough tax estimate

        # Expenses grow with inflation each year
        adjusted_expenses = monthly_expenses * ((1 + inflation_rate) ** y)

        # Employer match contribution
        employer_match = salary * (employer_match_pct / 100) / 12

        # Track debt payoff
        current_debt_payment = 0
        if remaining_debt > 0:
            current_debt_payment = monthly_debt_payments
            annual_principal_reduction = monthly_debt_payments * 12 * 0.6
            remaining_debt = max(0, remaining_debt - annual_principal_reduction)
        else:
            current_debt_payment = 0

        # Monthly net = take_home - expenses - debt_payments + employer_match
        monthly_net = (
            monthly_take_home - adjusted_expenses - current_debt_payment + employer_match
        )

        # If monthly net is negative, user is going deeper into debt — no investment growth
        if monthly_net < 0:
            annual_drain = monthly_net * 12
            all_paths[:, y + 1] = np.maximum(all_paths[:, y] + annual_drain, 0)
        else:
            annual_savings = monthly_net * 12
            growth = all_paths[:, y] * (1 + returns[:, y])
            all_paths[:, y + 1] = np.maximum(growth + annual_savings, 0)

    # Calculate percentiles
    percentiles = {}
    for p, label in [(10, "p10"), (25, "p25"), (50, "p50"), (75, "p75"), (90, "p90")]:
        pct_values = np.percentile(all_paths, p, axis=0)
        percentiles[label] = [
            {"age": current_age + i, "net_worth": round(float(v), 2)}
            for i, v in enumerate(pct_values)
        ]

    # FIRE targets (25x annual spending rule)
    goal_fire_target = 25 * goal_monthly_retirement_income * 12
    predicted_fire_target = 25 * predicted_monthly_retirement_income * 12

    # Find when median crosses each threshold
    median = np.percentile(all_paths, 50, axis=0)

    def find_crossing_age(threshold):
        for i, v in enumerate(median):
            if v >= threshold:
                return current_age + i
        return None

    goal_age = find_crossing_age(goal_fire_target)
    predicted_age = find_crossing_age(predicted_fire_target)

    fire_milestones = {
        "goal_fire_age": goal_age,
        "goal_fire_target": round(goal_fire_target, 2),
        "goal_achievable": goal_age is not None,
        "predicted_fire_age": predicted_age,
        "predicted_fire_target": round(predicted_fire_target, 2),
        "predicted_achievable": predicted_age is not None,
    }

    # Retirement readiness score (0-100, based on proximity to predicted fire)
    current_nw = float(median[0])
    if predicted_fire_target > 0:
        score = min(100, max(0, int((current_nw / predicted_fire_target) * 100)))
    else:
        score = 0

    # If predicted fire is achievable, boost score based on how soon
    if predicted_age is not None:
        years_to_predicted = predicted_age - current_age
        if years_to_predicted <= 5:
            score = max(score, 85)
        elif years_to_predicted <= 10:
            score = max(score, 65)
        elif years_to_predicted <= 20:
            score = max(score, 45)

    # Gap analysis for goal fire by 50
    gap_analysis = {}
    if goal_age is None or goal_age > 50:
        gap_analysis["goal_fire_by_50"] = {
            "required_salary_by_age": {},
            "suggested_roles": ["Senior SWE", "Engineering Manager", "Director"],
        }
        years_to_50 = max(1, 50 - current_age)
        needed_annual_savings = (goal_fire_target - current_nw) / years_to_50
        needed_salary = (
            needed_annual_savings / 0.3 + monthly_expenses * 12
        )
        gap_analysis["goal_fire_by_50"]["required_salary_by_age"] = {
            str(current_age + 5): round(needed_salary * 0.8),
            str(current_age + 10): round(needed_salary),
        }

    return {
        "percentiles": percentiles,
        "fire_milestones": fire_milestones,
        "retirement_readiness_score": score,
        "gap_analysis": gap_analysis,
    }
