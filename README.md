# ClauseGuard ⚖️

> **Understand any contract. Know your rights. Fight back.**
> An AI platform that reads a contract, explains every clause in plain language in the user's own
> language, flags unfair or illegal terms for their jurisdiction, and generates a response/complaint
> letter — built for gig workers, tenants, and migrants.

**SDGs:** 16 (Justice) · 8 (Decent Work) · 10 (Reduced Inequalities)
**100% free & open-source** · **Web + installable mobile app (one PWA codebase)** · **No hardware**

---

## What it does

1. **Scan / paste** a contract (image, PDF, text, or 🎙️ voice).
2. **Explain** each clause in plain language, in the chosen language.
3. **Flag** every clause `fair / unfair / illegal`, with a legal citation from the jurisdiction rule pack.
4. **Act** — generate a negotiation / objection / complaint letter, ask the know-your-rights chatbot,
   share a result link, or anonymously report a repeat-offender landlord/employer.

---

## Tech stack (all free)

| Layer | Tools |
|---|---|
| Frontend | React + Vite **PWA**, Tailwind, Web Speech API (voice) — host free on Vercel/Netlify |
| Backend | Python + FastAPI, SQLAlchemy — host free on Render/Railway |
| Database | PostgreSQL on Supabase/Neon free tier (SQLite locally) |
| AI | **Groq** free API (deployed) · **Ollama** Llama 3 (local) · `AI_MOCK` offline stub — one env switch |
| OCR | **Tesseract** (open-source) + pdfplumber |
| Map (roadmap) | **Leaflet + OpenStreetMap** (free, not Google Maps) |

---

## Project structure

```
clauseguard/
├── backend/            FastAPI API + rights engine + rule packs
│   ├── app/
│   │   ├── services/   ocr · segment · ai (Groq/Ollama switch) · rights
│   │   ├── routers/    analyze · letters · reports · chat
│   │   └── models, schemas, db, config, main
│   ├── rules/          IN.json · US-CA.json · sample_contract.txt
│   └── tests/          12 passing tests
└── frontend/           React PWA (Upload · Result · Letter · History)
```

---

## Run it locally (free)

### 1. Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # includes Tesseract Python binding

# Option A — no AI setup at all (offline deterministic stub):
AI_MOCK=true uvicorn app.main:app --reload

# Option B — real local AI, still free & private:
#   ollama pull llama3
AI_PROVIDER=ollama uvicorn app.main:app --reload
```
API runs at http://localhost:8000 (`/docs` for Swagger).
> For image OCR you also need the Tesseract binary: `brew install tesseract` (macOS) /
> `apt-get install tesseract-ocr` (Linux). Text & PDF work without it.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:8000
npm run dev                   # http://localhost:5173
```

Open the app → use **"Use sample"** on the Upload page for an instant demo.

---

## Deploy live (free)

1. **DB** — create a Supabase project, copy the Postgres `DATABASE_URL`.
2. **Backend** — Render → new Web Service from `backend/` (Dockerfile). Env:
   `AI_PROVIDER=groq`, `GROQ_API_KEY` (free from console.groq.com), `DATABASE_URL`.
3. **Frontend** — Vercel → import `frontend/`. Env: `VITE_API_URL=<render-url>`.

Same code runs free locally (Ollama) and free in production (Groq) — only `AI_PROVIDER` changes.
See the repo-root `DEPLOYMENT_GUIDE.md` for the full walkthrough.

---

## Demo with REAL AI (Ollama or Groq)

The app works three ways, all free — pick one:

```bash
cd backend && source .venv/bin/activate

# 1) No setup — deterministic offline stub
AI_MOCK=true python demo_ai.py

# 2) Real local AI, free & private
ollama pull llama3
AI_PROVIDER=ollama python demo_ai.py

# 3) Real cloud AI, free (key from https://console.groq.com, no card)
AI_PROVIDER=groq GROQ_API_KEY=gsk_xxx python demo_ai.py
```

`demo_ai.py` prints a live AI health check, then a full real analysis of a sample lease
(plain-language explanations, verdicts, citations, and a generated complaint letter).

To run the **server** with real AI, use the same env vars with uvicorn, then check it's live:

```bash
AI_PROVIDER=ollama uvicorn app.main:app --reload
curl http://localhost:8000/health/ai      # {"provider":"ollama","ok":true,...}
```

The frontend **"Try a sample contract"** buttons load three ready-made demos
(predatory lease, gig-worker contract, California job offer) with the right jurisdiction
pre-filled — one click to a full analysis.

## Tests

```bash
cd backend && AI_MOCK=true pytest      # 12 tests: segment, rights engine, full API pipeline
```

---

## Roadmap

Before-you-sign mode · clause rewrite suggestions · contract comparison · NGO/legal-aid hand-off ·
anonymous repeat-offender **map** (Leaflet/OSM) · Telegram bot · community jurisdiction-pack editor.
Every roadmap item is free — see `IMPLEMENTATION_PLAN.md`.

---

*Not legal advice. ClauseGuard helps people understand contracts and points them to professional help.*
