from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from routers.lines import router as lines_router
from routers.stops import router as stops_router
from routers.vehicles import router as vehicles_router
from services.mbta import MbtaService


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.mbta = MbtaService(settings)
    try:
        yield
    finally:
        await app.state.mbta.aclose()


app = FastAPI(title="Trains", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vehicles_router)
app.include_router(stops_router)
app.include_router(lines_router)


@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/health")
def health():
    return {"ok": True}
