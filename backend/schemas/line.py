from pydantic import BaseModel


class LinePoint(BaseModel):
    name: str | None = None
    lat: float
    lon: float


class Line(BaseModel):
    id: str
    route: str | None = None
    color: str
    points: list[LinePoint]
