import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)

app = FastAPI(title="LunaNav Scientific Backend", version="0.1.0",
              description="Mock mission analysis plus one local NASA LOLA elevation sample endpoint. No live NASA services or validated mission calculations.")
origins = [origin.strip() for origin in os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",") if origin.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False,
                   allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
app.include_router(router)
