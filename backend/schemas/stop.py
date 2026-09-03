from pydantic import BaseModel


class Stop(BaseModel):
    id: str
    line: str | None = None
    platform: str | None = None
    vehicle_type: int | None = None
    zone: str | None = None


class Station(BaseModel):
    name: str
    lines: list[str]
    lat: float | None = None
    lon: float | None = None
    stops: list[Stop]
