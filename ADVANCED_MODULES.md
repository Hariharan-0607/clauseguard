# JusticeAI — Advanced Intelligence & Legal Operating System

This document covers the advanced-module expansion built on top of the existing
ClauseGuard MVP. It explains **what was built**, **how it fits the architecture**,
**how to run it**, and the **roadmap** for the remaining modules.

> The MVP (auth, OCR, contract analysis, clause extraction, risk detection,
> rights awareness, complaint generation, reports, multilingual, chatbot) is
> unchanged. Everything here is additive.

---

## 1. What was built (this phase)

The 20 requested modules collapse into 5 capability clusters with heavy overlap.
This phase delivers **4 buildable units that cover ~12 of the 20 modules**, all
runnable and tested:

| Built unit | Covers requested modules |
|---|---|
| **Detection Engine** (taxonomy-driven) | 1 Human Rights · 2 Exploitation · 12 Consumer · 13 Dark Patterns · 14 HR Compliance · 15 Vendor Risk |
| **Case Management** | 5 Case Management |
| **Estimation Engines** | 6 Settlement · 7 Compensation · 8 Legal Cost Prediction |
| **Protection Passports** | 9 Worker · 10 Migrant · 11 Rental |
| **Personal Legal Agent** (RAG) | 19 Personal Legal AI Agent |

That is **15 of the 20 modules** built and tested. Remaining: 3 Investigation,
4 Fraud, 16 Knowledge Graph, 17 Research Agent, 20 Multi-Agent (see §6 roadmap).

The Detection Engine is **config-driven**: each "module" (Human Rights,
Exploitation, …) is a JSON taxonomy file in [`backend/taxonomies/`](backend/taxonomies/).
Adding a new detection product = adding a JSON file, not new code.

---

## 2. Architecture

Clean Architecture / SOLID / Repository / Service Layer / Event-Driven — all
realised in `backend/app`:

```
app/
  core/                     # cross-cutting infrastructure (NEW)
    roles.py                #   RBAC: Role enum + Permission matrix
    rbac.py                 #   FastAPI deps: require_permission / require_role
    repository.py           #   generic Repository[Model] over SQLAlchemy
    events.py               #   in-process event bus (broker-ready interface)
  services/                 # business logic (Service Layer)
    detection.py            #   DetectionService  -> Detection + findings
    cases.py                #   CaseService       (+ event subscriber)
    estimation.py           #   EstimationService (deterministic calculators)
    agent.py                #   AgentService      (+ event subscribers, RAG)
    taxonomy.py             #   taxonomy loader (Detection Engine config)
    analytics.py            #   read-side dashboards / trends
    vectorstore.py          #   ChromaDB facade + in-memory fallback
    ai.py                   #   LLM access (existing) + call_llm_json + assess_violation
  routers/                  # thin HTTP layer (Interface adapters)
    detection.py  cases.py  estimation.py  agent.py
  models.py                 # ORM models (MVP + advanced)
migrations/                 # Alembic (NEW)
taxonomies/                 # detection domain config (NEW)
```

**Dependency direction:** `routers → services → repository → models`. Routers never
touch the DB session directly except to pass it down. Services own the transaction
boundary (unit of work).

### Event-Driven flow (example)
```
POST /detection/run
  └─ DetectionService.run()  persists Detection
       └─ events.publish("detection.completed", ...)
            ├─ agent._seed_from_detection()  -> writes AgentMemory + vector doc
            └─ cases._on_detection_completed() -> (hook for case linkage)
```
A failing subscriber is isolated and logged; it never breaks the publisher.

### RBAC model

| Role | Key permissions |
|---|---|
| `user` (default — MVP behaviour) | run detection, create/read own cases, run estimates, use agent |
| `caseworker` | + read/update/assign **any** case |
| `reviewer` | + review/override detection findings |
| `admin` | everything (incl. user + taxonomy management) |

Routes gate with `Depends(require_permission(Permission.X))`. The `users.role`
column defaults to `"user"`, so existing accounts keep working unchanged.

---

## 3. Data model (advanced tables)

- `detections` / `detection_findings` — detection runs + per-violation findings
- `cases` / `case_events` / `evidence` — case spine, timeline, evidence (metadata only)
- `estimates` — saved compensation/settlement estimates (audit trail)
- `agent_memories` / `agent_messages` — persistent agent memory + conversation log
- `users.role` — RBAC

Privacy by design is preserved: evidence stores **metadata + descriptions**, not
raw uploaded files.

---

## 4. API surface (new)

```
GET   /detection/domains
POST  /detection/run
GET   /detection/detections[?domain=]
GET   /detection/detections/{id}
PATCH /detection/findings/{id}/review        (reviewer/admin)
GET   /detection/analytics/{domain}

POST  /cases                                  GET /cases    GET /cases/{id}
PATCH /cases/{id}                             GET /cases/analytics
POST  /cases/{id}/events                      POST /cases/{id}/evidence

POST  /estimation/compensation                POST /estimation/settlement
GET   /estimation/estimates

POST  /agent/chat
GET   /agent/memories   POST /agent/memories   DELETE /agent/memories/{id}
```

Full interactive docs at `/docs` (FastAPI/OpenAPI).

---

## 5. Running the full stack

```bash
# From repo root — Postgres + ChromaDB + API
docker compose up --build

# API on :8000 (migrations run automatically), ChromaDB on :8001, Postgres on :5432
```

Environment (see `docker-compose.yml` / `backend/app/config.py`):
- `DATABASE_URL` — `postgresql+psycopg://…` in Docker; `sqlite:///…` for local/tests
- `CHROMA_URL` — `http://chroma:8000`; **unset → in-memory vector store fallback**
- `AI_PROVIDER` — `groq` (deployed) / `ollama` (local) / `AI_MOCK=true` (offline)

### Migrations
```bash
cd backend
alembic upgrade head                 # apply
alembic revision --autogenerate -m "msg"   # new migration after model changes
```

### Tests
```bash
cd backend && pytest                 # 35 tests (23 MVP + 12 advanced), all green
```
Tests run fully offline (`AI_MOCK=true`, throwaway SQLite, in-memory vector store) —
no Postgres/Chroma/LLM required.

---

## 6. Roadmap — remaining 16 modules

Ordered by leverage; each reuses the foundation already built.

**Phase 2 — fast follows (config/derivative on existing engines)**
- **3 Investigation Engine / 4 Fraud Platform** — extend Case Management with
  entity/event/timeline extraction; add an `investigation` taxonomy + `Entity`,
  `TimelineEvent` tables. Reuses DetectionService + CaseService.
- **8 Legal Cost Prediction** — third calculator in `estimation.py` (same pattern
  as compensation/settlement).
- **18 Government Complaint Automation** — template engine over existing letter
  generation + case status tracking.

**Phase 3 — vertical passports (wrap Detection + Case)**
- **9 Worker Passport / 10 Migrant / 11 Rental** — a `Profile` aggregate that
  bundles a user's detections, cases, estimates into a portable record + trust score.

**Phase 4 — AI/knowledge layer**
- **16 Legal Knowledge Graph** — add a graph store (Neo4j or pgvector + edges);
  ingest laws/judgments; expose graph search. Foundation for 17.
- **17 Autonomous Research Agent** — LangChain agent with RAG (vectorstore.py) +
  knowledge-graph retrieval tools. Builds on the Personal Agent's RAG plumbing.
- **20 Multi-Agent System** — orchestrator over Contract/Evidence/Research/
  Complaint/Negotiation/Compliance agents, each backed by an existing service;
  shared memory via `agent_memories` + vectorstore; human-approval workflow via
  case events. The event bus is the agent-to-agent transport.

**Cross-cutting (do alongside Phase 2)**
- Promote the event bus from in-process to Redis/Kafka (interface already isolates this).
- Add per-role seed/admin endpoints for user role management.
- Object storage + encryption for evidence files (currently metadata-only).

---

## 7. Why this shape

20 modules × 11 artifacts as one code drop would be ~150 unvetted files that
wouldn't run against the real schema. Instead this phase delivers a **proven,
tested foundation + 4 working modules** that demonstrate every required pattern
(RBAC, repository, service layer, event-driven, AI pipeline, RAG, agent,
dashboards, tests) — so the remaining modules are *configuration and repetition*
of established patterns rather than net-new architecture.
