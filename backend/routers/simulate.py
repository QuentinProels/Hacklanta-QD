from fastapi import APIRouter
from models.schemas import SimulateRequest
from services.monte_carlo import run_simulation

router = APIRouter()


@router.post("/api/simulate")
async def simulate(req: SimulateRequest):
    result = run_simulation(
        current_age=req.current_age,
        retirement_target_age=req.retirement_target_age,
        annual_salary=req.annual_salary,
        salary_progression=[sp.model_dump() for sp in req.salary_progression],
        monthly_expenses=req.monthly_expenses,
        monthly_debt_payments=req.monthly_debt_payments,
        total_debt=req.total_debt,
        current_assets=req.current_assets.model_dump(),
        monthly_savings_rate=req.monthly_savings_rate,
        employer_match_pct=req.employer_match_pct,
        safe_withdrawal_rate=req.safe_withdrawal_rate,
        goal_monthly_retirement_income=req.goal_monthly_retirement_income,
        predicted_monthly_retirement_income=req.predicted_monthly_retirement_income,
    )
    return result
