from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from routers import simulate, debt, budget, insights

app = FastAPI(title="CoastLine API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://coast-line-3s96kaz8b-streetlamp05s-projects.vercel.app", "https://coast-line-sandy.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(simulate.router)
app.include_router(debt.router)
app.include_router(budget.router)
app.include_router(insights.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
