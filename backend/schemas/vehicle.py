from pydantic import BaseModel, Field


class Vehicle(BaseModel):
    id: str
    label: str | None = None
    route: str | None = None
    current_status: str | None = None
    current_stop_sequence: int | None = None
    direction_id: int | None = None
    latitude: float | None = None
    longitude: float | None = None
    speed: float | None = None
    carriages: int = Field(description="Number of carriages")
    updated_at: str | None = None
