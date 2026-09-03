from typing import Annotated

from fastapi import APIRouter, Query

from routers.deps import MbtaDep
from schemas.stop import Station

router = APIRouter(tags=["stops"])

# Light rail, heavy rail, commuter rail — same modes as /vehicles trains.
DEFAULT_ROUTE_TYPES = "0,1,2"


@router.get("/stops")
async def list_stops(
    mbta: MbtaDep,
    route_type: Annotated[
        str,
        Query(description="0=light rail, 1=heavy rail, 2=commuter rail, 3=bus, 4=ferry"),
    ] = DEFAULT_ROUTE_TYPES,
) -> list[Station]:
    return await mbta.list_stops(route_type=route_type)
