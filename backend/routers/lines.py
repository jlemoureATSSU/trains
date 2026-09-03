from typing import Annotated

from fastapi import APIRouter, Query

from routers.deps import MbtaDep
from schemas.line import Line

router = APIRouter(tags=["lines"])


@router.get("/lines")
async def list_lines(
    mbta: MbtaDep,
    route_type: Annotated[
        str,
        Query(description="0=light rail, 1=heavy rail, 2=commuter rail, 3=bus, 4=ferry"),
    ] = "0,1,2",
) -> list[Line]:
    return await mbta.list_lines(route_type=route_type)
