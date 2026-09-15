from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.config import settings
from app.routers import auth, bugs, analytics, knowledge_base, chat, admin, notifications

# Create tables on startup (fine for SQLite / local dev; use Alembic migrations in production)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Intelligent Bug Diagnosis Platform with Fix Recommendation Assistance API",
    description="REST API for submitting, tracking, and analyzing bug reports.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(bugs.router)
app.include_router(analytics.router)
app.include_router(knowledge_base.router)
app.include_router(chat.router)
app.include_router(admin.router)
app.include_router(notifications.router)


@app.get("/api/health", tags=["health"])
def health_check():
    return {"status": "ok", "service": "smart-bug-analyzer-api"}
