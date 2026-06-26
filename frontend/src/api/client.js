const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function token() { return localStorage.getItem('cg_token') || '' }
export function setToken(t) { t ? localStorage.setItem('cg_token', t) : localStorage.removeItem('cg_token') }

function authHeaders(extra = {}) {
  const t = token()
  return t ? { ...extra, Authorization: `Bearer ${t}` } : extra
}

async function handle(res) {
  if (!res.ok) {
    let detail = res.statusText
    try { detail = (await res.json()).detail || detail } catch { /* ignore */ }
    throw new Error(detail)
  }
  return res.json()
}

const j = (extra = {}) => authHeaders({ 'Content-Type': 'application/json', ...extra })

// --- auth ---
export const signup = (body) => fetch(`${BASE}/auth/signup`, { method: 'POST', headers: j(), body: JSON.stringify(body) }).then(handle)
export const login = (body) => fetch(`${BASE}/auth/login`, { method: 'POST', headers: j(), body: JSON.stringify(body) }).then(handle)
export const me = () => fetch(`${BASE}/auth/me`, { headers: authHeaders() }).then(handle)

// --- analyze ---
export const analyzeText = (b) => fetch(`${BASE}/analyze`, { method: 'POST', headers: j(), body: JSON.stringify(b) }).then(handle)
export function analyzeFile({ file, language, jurisdiction, counterparty, title }) {
  const form = new FormData()
  form.append('file', file); form.append('language', language); form.append('jurisdiction', jurisdiction)
  form.append('counterparty', counterparty || ''); form.append('title', title || 'Contract')
  return fetch(`${BASE}/analyze/upload`, { method: 'POST', headers: authHeaders(), body: form }).then(handle)
}
export function extractFile(file) {
  const form = new FormData()
  form.append('file', file)
  return fetch(`${BASE}/extract`, { method: 'POST', headers: authHeaders(), body: form }).then(handle)
}
export const getAnalysis = (id) => fetch(`${BASE}/analyses/${id}`).then(handle)
export const listAnalyses = () => fetch(`${BASE}/analyses`, { headers: authHeaders() }).then(handle)

// --- letters / chat ---
export const makeLetter = ({ analysisId, letterType, language }) =>
  fetch(`${BASE}/letters`, { method: 'POST', headers: j(), body: JSON.stringify({ analysis_id: analysisId, letter_type: letterType, language }) }).then(handle)
export const askChat = (body) => fetch(`${BASE}/chat`, { method: 'POST', headers: j(), body: JSON.stringify(body) }).then(handle)
// body: { question, jurisdiction, language, page_context, page_name }

export const advise = (body) => fetch(`${BASE}/advise`, { method: 'POST', headers: j(), body: JSON.stringify(body) }).then(handle)
// body: { situation, jurisdiction, language }

// redline: draft a message for one flagged clause
export const clauseMessage = (body) => fetch(`${BASE}/clauses/message`, { method: 'POST', headers: j(), body: JSON.stringify(body) }).then(handle)
// body: { analysis_id, clause_order, language }

// redraft the whole contract into a fair version
export const redraftAnalysis = (id, language) =>
  fetch(`${BASE}/analyses/${id}/redraft`, { method: 'POST', headers: j(), body: JSON.stringify({ language }) }).then(handle)

// contract comparison
export const compareContracts = (body) => fetch(`${BASE}/compare`, { method: 'POST', headers: j(), body: JSON.stringify(body) }).then(handle)
// body: { text_a, text_b, label_a, label_b, jurisdiction, language }

// saved advisor plans
export const savePlan = (plan) => fetch(`${BASE}/advise/save`, { method: 'POST', headers: j(), body: JSON.stringify(plan) }).then(handle)
export const listPlans = () => fetch(`${BASE}/advise/plans`, { headers: authHeaders() }).then(handle)
export const getPlan = (id) => fetch(`${BASE}/advise/plans/${id}`, { headers: authHeaders() }).then(handle)

// --- reports / map ---
export function fileReport(analysisId, lat, lon) {
  const q = lat && lon ? `?lat=${lat}&lon=${lon}` : ''
  return fetch(`${BASE}/reports/${analysisId}${q}`, { method: 'POST' }).then(handle)
}
export const listReports = () => fetch(`${BASE}/reports`).then(handle)

// --- library / directory ---
export const listTopics = () => fetch(`${BASE}/library`).then(handle)
export const getTopic = (id) => fetch(`${BASE}/library/${id}`).then(handle)
export const listOrgs = (country) => fetch(`${BASE}/directory${country ? `?country=${country}` : ''}`).then(handle)

// --- deadlines ---
export const listDeadlines = () => fetch(`${BASE}/deadlines`, { headers: authHeaders() }).then(handle)
export const addDeadline = (b) => fetch(`${BASE}/deadlines`, { method: 'POST', headers: j(), body: JSON.stringify(b) }).then(handle)
export const toggleDeadline = (id) => fetch(`${BASE}/deadlines/${id}`, { method: 'PATCH', headers: authHeaders() }).then(handle)
export const deleteDeadline = (id) => fetch(`${BASE}/deadlines/${id}`, { method: 'DELETE', headers: authHeaders() }).then(handle)

// --- translation ---
export const translateBatch = (texts, language) =>
  fetch(`${BASE}/translate`, { method: 'POST', headers: j(), body: JSON.stringify({ texts, language }) })
    .then(handle).then((d) => d.translations)

// --- misc ---
export const aiHealth = () => fetch(`${BASE}/health/ai`).then(handle)
