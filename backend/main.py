"""
SafeClick AI — Python Backend (FastAPI)

This is the main entry point for the Python backend.
It creates the FastAPI app, adds CORS middleware (so the
React frontend can call it), and registers all API routes.

To run:
    cd SafeClick-AI-main
    uvicorn backend.main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.routers import analyze, chat, daily_briefing

# Create the FastAPI app
app = FastAPI(
    title="SafeClick AI Backend",
    description="Python backend for cybersecurity analysis powered by Gemini AI",
    version="1.0.0",
)

# Allow the React frontend (localhost:9002) to call our API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://localhost:9002", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes — all prefixed with /api
app.include_router(analyze.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(daily_briefing.router, prefix="/api")


@app.get("/api/health")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "SafeClick AI Python Backend"}

app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
