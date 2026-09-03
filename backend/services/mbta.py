import re
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

import httpx
from fastapi import HTTPException

from config import Settings
from schemas.line import Line, LinePoint
from schemas.stop import Station, Stop
from schemas.vehicle import Vehicle

# Route-pattern IDs to omit from GET /lines (special event / extra CR branches, etc.).
EXCLUDED_LINE_IDS = frozenset(
    {
        "CR-Foxboro-C1-0",
    }
)


class MbtaService:
    def __init__(self, settings: Settings) -> None:
        self._client = httpx.AsyncClient(
            base_url=settings.mbta_base_url.rstrip("/"),
            headers={
                "x-api-key": settings.mbta_api_key,
                "Accept": "application/vnd.api+json",
            },
            timeout=30.0,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def list_vehicles(self, route_type: str | None = None) -> list[Vehicle]:
        params: dict[str, str] = {}
        if route_type:
            params["filter[route_type]"] = route_type
        payload = await self._get("/vehicles", params)
        return [parse_vehicle(item) for item in payload.get("data", [])]

    async def get_vehicle(self, vehicle_id: str) -> Vehicle:
        payload = await self._get(f"/vehicles/{vehicle_id}", {})
        return parse_vehicle(payload["data"])

    async def list_stops(self, route_type: str | None = None) -> list[Station]:
        params: dict[str, str] = {}
        if route_type:
            params["filter[route_type]"] = route_type
        payload = await self._get("/stops", params)
        return consolidate_stops(parse_stop(item) for item in payload.get("data", []))

    async def list_lines(self, route_type: str = "0,1,2") -> list[Line]:
        routes_payload = await self._get(
            "/routes",
            {"filter[type]": route_type, "page[limit]": "100"},
        )
        routes = {item["id"]: item for item in routes_payload.get("data", [])}
        if not routes:
            return []

        patterns_payload = await self._get(
            "/route_patterns",
            {
                "filter[canonical]": "true",
                "filter[direction_id]": "0",
                "filter[route]": ",".join(routes),
                "page[limit]": "200",
            },
        )
        patterns = [
            pattern
            for pattern in patterns_payload.get("data", [])
            if pattern["id"] not in EXCLUDED_LINE_IDS
        ]
        trip_ids = list(
            dict.fromkeys(
                tid
                for pattern in patterns
                if (tid := _rel_id(pattern, "representative_trip"))
            )
        )
        if not trip_ids:
            return []

        trips_payload = await self._get(
            "/trips",
            {
                "filter[id]": ",".join(trip_ids),
                "include": "stops",
                "page[limit]": "200",
            },
        )
        trips = {item["id"]: item for item in trips_payload.get("data", [])}
        included = _index_included(trips_payload.get("included", []))

        lines: list[Line] = []
        for pattern in patterns:
            route_id = _rel_id(pattern, "route")
            route = routes.get(route_id or "")
            trip = trips.get(_rel_id(pattern, "representative_trip") or "")
            if not route or not trip:
                continue
            points = _trip_points(trip, included)
            if len(points) < 2:
                continue
            lines.append(
                Line(
                    id=pattern["id"],
                    route=route_id,
                    color=_route_color(route),
                    points=points,
                )
            )
        return lines

    async def _get(self, path: str, params: dict[str, str]) -> dict[str, Any]:
        try:
            response = await self._client.get(path, params=params)
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Unable to reach MBTA API: {exc}",
            ) from exc

        if response.is_error:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json()


def _rel_id(item: dict[str, Any], name: str) -> str | None:
    data = item.get("relationships", {}).get(name, {}).get("data")
    if isinstance(data, dict):
        return data.get("id")
    return None


def _rel_list(item: dict[str, Any], name: str) -> list[str]:
    data = item.get("relationships", {}).get(name, {}).get("data")
    if not isinstance(data, list):
        return []
    return [ref["id"] for ref in data if isinstance(ref, dict) and ref.get("id")]


def _index_included(
    included: list[dict[str, Any]],
) -> dict[tuple[str, str], dict[str, Any]]:
    return {(item["type"], item["id"]): item for item in included}


def _route_color(route: dict[str, Any]) -> str:
    color = (route.get("attributes") or {}).get("color") or "888888"
    return color if color.startswith("#") else f"#{color}"


def _trip_points(
    trip: dict[str, Any],
    included: dict[tuple[str, str], dict[str, Any]],
) -> list[LinePoint]:
    points: list[LinePoint] = []
    for stop_id in _rel_list(trip, "stops"):
        stop = included.get(("stop", stop_id))
        if not stop:
            continue
        attrs = stop.get("attributes") or {}
        lat = attrs.get("latitude")
        lon = attrs.get("longitude")
        if lat is None or lon is None:
            continue
        points.append(LinePoint(name=attrs.get("name"), lat=lat, lon=lon))
    return points


def parse_vehicle(item: dict[str, Any]) -> Vehicle:
    attrs = item.get("attributes") or {}
    carriages = attrs.get("carriages") or []

    return Vehicle(
        id=item["id"],
        label=attrs.get("label"),
        route=_rel_id(item, "route"),
        current_status=attrs.get("current_status"),
        current_stop_sequence=attrs.get("current_stop_sequence"),
        direction_id=attrs.get("direction_id"),
        latitude=attrs.get("latitude"),
        longitude=attrs.get("longitude"),
        speed=attrs.get("speed"),
        carriages=len(carriages),
        updated_at=attrs.get("updated_at"),
    )


_GREEN_BRANCH = re.compile(r"\(([BCDE])\)")


def parse_line(description: str | None) -> str | None:
    """Line is the second ` - `-separated segment. Green branches are in the third."""
    if not description:
        return None
    parts = [part.strip() for part in description.split(" - ")]
    if len(parts) < 2:
        return None
    line = parts[1]
    if line == "Green Line" and len(parts) > 2:
        letters = list(dict.fromkeys(_GREEN_BRANCH.findall(parts[2])))
        if letters:
            line = f"Green Line {'/'.join(letters)}"
    return line


@dataclass
class ParsedStop:
    id: str
    name: str
    line: str | None
    platform: str | None
    vehicle_type: int | None
    zone: str | None
    lat: float | None
    lon: float | None


def parse_stop(item: dict[str, Any]) -> ParsedStop:
    attrs = item.get("attributes") or {}
    return ParsedStop(
        id=item["id"],
        name=attrs.get("name") or "",
        line=parse_line(attrs.get("description")),
        platform=attrs.get("platform_name"),
        vehicle_type=attrs.get("vehicle_type"),
        zone=_rel_id(item, "zone"),
        lat=attrs.get("latitude"),
        lon=attrs.get("longitude"),
    )


def consolidate_stops(stops: Iterable[ParsedStop]) -> list[Station]:
    groups: dict[str, Station] = {}
    order: list[str] = []
    for stop in stops:
        key = stop.name.casefold()
        group = groups.get(key)
        if group is None:
            group = Station(name=stop.name, lines=[], lat=stop.lat, lon=stop.lon, stops=[])
            groups[key] = group
            order.append(key)
        if stop.line and stop.line not in group.lines:
            group.lines.append(stop.line)
        group.stops.append(
            Stop(
                id=stop.id,
                line=stop.line,
                platform=stop.platform,
                vehicle_type=stop.vehicle_type,
                zone=stop.zone,
            )
        )
    return [groups[key] for key in order]
