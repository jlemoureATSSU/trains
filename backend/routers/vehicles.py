from typing import Annotated

from fastapi import APIRouter, Query

from routers.deps import MbtaDep
from schemas.vehicle import Vehicle

router = APIRouter(tags=["vehicles"])


@router.get("/vehicles")
async def list_vehicles(
    mbta: MbtaDep,
    route_type: Annotated[
        str | None,
        Query(description="0=light rail, 1=heavy rail, 2=commuter rail, 3=bus, 4=ferry"),
    ] = None,
) -> list[Vehicle]:
    return await mbta.list_vehicles(route_type=route_type)


@router.get("/vehicles/{vehicle_id}")
async def get_vehicle(vehicle_id: str, mbta: MbtaDep) -> Vehicle:
    return await mbta.get_vehicle(vehicle_id)
