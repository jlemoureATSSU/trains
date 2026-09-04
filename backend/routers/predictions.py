from typing import Annotated

from fastapi import APIRouter, Query

from routers.deps import MbtaDep
from schemas.prediction import Prediction

router = APIRouter(tags=["predictions"])


@router.get("/predictions")
async def list_predictions(
    mbta: MbtaDep,
    stop: Annotated[
        str,
        Query(
            description="MBTA stop or parent station ID. Comma-separated for multiple."
        ),
    ],
    route: Annotated[
        str | None,
        Query(description="Filter by route ID. Comma-separated for multiple."),
    ] = None,
    direction_id: Annotated[
        str | None,
        Query(description="0=outbound, 1=inbound"),
    ] = None,
) -> list[Prediction]:
    return await mbta.list_predictions(
        stop=stop,
        route=route,
        direction_id=direction_id,
    )
