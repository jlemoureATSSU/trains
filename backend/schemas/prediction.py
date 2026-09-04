from pydantic import BaseModel


class Prediction(BaseModel):
    id: str
    stop: str | None = None
    route: str | None = None
    trip: str | None = None
    vehicle: str | None = None
    direction_id: int | None = None
    arrival_time: str | None = None
    departure_time: str | None = None
    status: str | None = None
    headsign: str | None = None
    stop_sequence: int | None = None
    schedule_relationship: str | None = None
