from typing import Annotated

from fastapi import Depends, Request

from services.mbta import MbtaService


def get_mbta_service(request: Request) -> MbtaService:
    return request.app.state.mbta


MbtaDep = Annotated[MbtaService, Depends(get_mbta_service)]
