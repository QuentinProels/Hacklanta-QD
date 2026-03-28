const API_URL = '';

async function fetchApi<T>(endpoint: string, body: any): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function runSimulation(params: any) {
  return fetchApi('/api/simulate', params);
}

export async function getDebtPayoff(params: any) {
  return fetchApi('/api/debt-payoff', params);
}

export async function getBudgetAnalysis(params: any) {
  return fetchApi('/api/budget-analysis', params);
}

export async function getAiInsights(params: any) {
  return fetchApi('/api/ai-insights', params);
}
