"""ClauseGuard API — FastAPI app entrypoint."""
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import settings
from app.db import Base, engine, get_db, SessionLocal
from app.models import Report, User
from app.routers import (admin, advise, agent, analyze, auth, cases, chat,
                         compare, deadlines, detection, estimation, letters,
                         library, passport, reports, translate)
from app.services.ai import ai_health
from app.services.auth import hash_password
# Import services with event subscribers so their @subscribe handlers register.
import app.services.cases  # noqa: F401  (registers case event subscribers)
import app.services.agent  # noqa: F401  (registers agent memory subscribers)

Base.metadata.create_all(bind=engine)

# --- Seed ready-to-use demo accounts (one per RBAC role) so anyone can sign in
#     instantly and see exactly what each role can do. All share one password. ---
DEMO_PASSWORD = "demo1234"

# (email, display name, role). The original demo@clauseguard.app stays as admin
# for backward compatibility; the role-specific accounts are added alongside it.
DEMO_ACCOUNTS = [
    ("demo@clauseguard.app", "Demo Admin", "admin"),
    ("user@clauseguard.app", "Demo User", "user"),
    ("caseworker@clauseguard.app", "Demo Caseworker", "caseworker"),
    ("reviewer@clauseguard.app", "Demo Reviewer", "reviewer"),
    ("admin@clauseguard.app", "Demo Admin", "admin"),
]


def _seed_demo_users():
    """Create each demo account if missing; self-heal the role if it drifted."""
    db = SessionLocal()
    try:
        for email, name, role in DEMO_ACCOUNTS:
            existing = db.query(User).filter(User.email == email).first()
            if not existing:
                db.add(User(email=email, name=name, role=role,
                            password_hash=hash_password(DEMO_PASSWORD)))
            elif existing.role != role:
                existing.role = role
        db.commit()
    finally:
        db.close()


_seed_demo_users()

app = FastAPI(
    title="ClauseGuard API",
    description="Understand any contract. Know your rights. Fight back. (100% free stack)",
    version="2.0.0",
)

origins = ["*"] if settings.frontend_origin == "*" else [settings.frontend_origin]
app.add_middleware(
    CORSMiddleware, allow_origins=origins, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

for r in (auth, analyze, letters, reports, chat, library, deadlines, translate, advise, compare,
          detection, cases, estimation, agent, passport, admin):
    app.include_router(r.router)


@app.get("/")
def root():
    return {"name": "ClauseGuard", "status": "ok", "ai_provider": settings.ai_provider,
            "ai_mock": settings.ai_mock, "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/health/ai")
def health_ai():
    return ai_health()


# Seed sample map data once (idempotent) so the repeat-offender map isn't empty in a demo.
SEED = [
    ("Skyline Rentals", "landlord", "IN", "Chennai", 13.0827, 80.2707),
    ("QuickDeliver Pvt Ltd", "platform", "IN", "Bengaluru", 12.9716, 77.5946),
    ("Metro Stay Apartments", "landlord", "IN", "Mumbai", 19.0760, 72.8777),
    ("Westbay Tech Inc", "employer", "US-CA", "San Francisco", 37.7749, -122.4194),
    ("Golden Gate Properties", "landlord", "US-CA", "Oakland", 37.8044, -122.2712),
]


@app.post("/seed-demo")
def seed_demo(db: Session = Depends(get_db)):
    if db.query(Report).count() == 0:
        for name, cat, jur, city, lat, lon in SEED:
            for _ in range(2 if cat == "landlord" else 1):
                db.add(Report(counterparty=name, category=cat, jurisdiction=jur,
                              worst_verdict="illegal", city=city, lat=lat, lon=lon))
        db.commit()
    return {"reports": db.query(Report).count()}
