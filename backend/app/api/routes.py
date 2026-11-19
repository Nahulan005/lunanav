from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.providers.horizons import JplHorizonsGeometryProvider
from app.providers.lola import LolaTerrainProvider, TerrainSampleError
from app.providers.mock import (
    MockEphemerisProvider,
    MockImageryProvider,
    MockTerrainProvider,
    MockVisibilityAnalysisProvider,
)
from app.schemas.analysis import AnalysisRequest, AnalysisResponse, HealthResponse
from app.schemas.geometry import SunEarthGeometryResponse
from app.schemas.site04_coverage import Site04CoverageResponse
from app.providers.site04_coverage import get_site04_coverage
from app.providers.site04_terrain import get_site04_terrain
from app.schemas.site04_terrain import Site04TerrainResponse, Site04Footprint
from app.providers.site04_coordinates import to_lat_lon
from app.providers.site04_windows import read_window, OutsideSite04Coverage
from app.schemas.terrain import TerrainProfile, TerrainSampleResponse
from app.services.analysis import AnalysisService

router = APIRouter(prefix="/api/v1")


def get_analysis_service() -> AnalysisService:
    return AnalysisService(
        MockTerrainProvider(),
        MockEphemerisProvider(),
        MockImageryProvider(),
        MockVisibilityAnalysisProvider(),
    )


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    # Capability metadata, not an external-service uptime probe. Analysis stays mock.
    integrations = []
    try:
        get_terrain_provider().sample(20.19, 30.77)
    except TerrainSampleError:
        pass  # Do not advertise a local dataset that fails its integrity checks.
    else:
        integrations.append("LOLA: local dataset (integrity checked; not a live NASA service)")
    if get_geometry_provider().enable_network:
        integrations.append("JPL Horizons: live API enabled (reachability not checked)")
    return HealthResponse(mode="hybrid", live_nasa_integrations=integrations)


@router.post("/analysis", response_model=AnalysisResponse)
def analyze(
    request: AnalysisRequest,
    service: Annotated[AnalysisService, Depends(get_analysis_service)],
) -> AnalysisResponse:
    return service.analyze(request)


def get_terrain_provider() -> LolaTerrainProvider:
    return LolaTerrainProvider()


@router.get("/terrain/sample", response_model=TerrainSampleResponse)
def terrain_sample(
    latitude: Annotated[float, Query(ge=-90, le=90, allow_inf_nan=False)],
    longitude: Annotated[float, Query(ge=-180, le=180, allow_inf_nan=False)],
    provider: Annotated[LolaTerrainProvider, Depends(get_terrain_provider)],
) -> TerrainSampleResponse:
    try:
        return provider.sample(latitude, longitude)
    except TerrainSampleError as error:
        raise HTTPException(
            status_code=error.status_code,
            detail={"code": error.code, "message": str(error)},
        ) from error


@router.get("/terrain/profile", response_model=TerrainProfile)
def terrain_profile(
    latitude: Annotated[float, Query(ge=-90, le=90, allow_inf_nan=False)],
    longitude: Annotated[float, Query(ge=-180, le=180, allow_inf_nan=False)],
    provider: Annotated[LolaTerrainProvider, Depends(get_terrain_provider)],
) -> TerrainProfile:
    try:
        return provider.profile(latitude, longitude)
    except TerrainSampleError as error:
        raise HTTPException(
            status_code=error.status_code,
            detail={"code": error.code, "message": str(error)},
        ) from error


def get_geometry_provider() -> JplHorizonsGeometryProvider:
    return JplHorizonsGeometryProvider()


@router.get("/geometry/sun-earth", response_model=SunEarthGeometryResponse)
def get_sun_earth_geometry(
    latitude: Annotated[
        float,
        Query(
            ge=-90,
            le=90,
            allow_inf_nan=False,
            description="Observer latitude on lunar surface in degrees [-90, +90]",
        ),
    ],
    longitude: Annotated[
        float,
        Query(
            ge=-180,
            le=180,
            allow_inf_nan=False,
            description="Observer east-longitude on lunar surface in degrees [-180, +180]",
        ),
    ],
    landing_date: Annotated[
        date | None,
        Query(alias="landingDate", description="Target observation date (UTC)."),
    ] = None,
    date: Annotated[
        date | None,
        Query(description="Alternative parameter name for target observation date (UTC)."),
    ] = None,
    site_id: Annotated[
        str,
        Query(
            alias="siteId",
            min_length=1,
            max_length=80,
            description="Site identifier (e.g. shackleton, apollo17, custom)",
        ),
    ] = "custom",
    observer_height_m: Annotated[
        float,
        Query(
            ge=0,
            le=1000,
            allow_inf_nan=False,
            description="Observer height above reference surface in metres",
        ),
    ] = 2.0,
    provider: Annotated[
        JplHorizonsGeometryProvider, Depends(get_geometry_provider)
    ] = None,
) -> SunEarthGeometryResponse:
    target_date = landing_date or date
    if target_date is None:
        raise HTTPException(
            status_code=422,
            detail="Query parameter 'landingDate' or 'date' is required.",
        )
    return provider.get_sun_earth_geometry(
        site_id=site_id,
        latitude=latitude,
        longitude=longitude,
        target_date=target_date,
        observer_height_m=observer_height_m,
    )

@router.get("/terrain/site04/coverage", response_model=Site04CoverageResponse,
            summary="Site04 observation coverage: bounded provisional native window")
def site04_observation_coverage() -> Site04CoverageResponse:
    """Return the pinned 32x32 source-frame window, or unavailable on integrity failure."""
    return get_site04_coverage()


@router.get("/terrain/site04/grid", response_model=Site04TerrainResponse,
            summary="Bounded native Site04 elevation, slope and RMS uncertainties")
def site04_terrain_grid(
    latitude: Annotated[float | None, Query(ge=-90, le=90, allow_inf_nan=False)] = None,
    longitude: Annotated[float | None, Query(ge=-180, le=180, allow_inf_nan=False)] = None,
    width: Annotated[int, Query(ge=1, le=32)] = 32,
) -> Site04TerrainResponse:
    if latitude is None and longitude is None:
        return get_site04_terrain()
    if latitude is None or longitude is None:
        raise HTTPException(status_code=422, detail={"code": "COORDINATE_PAIR_REQUIRED", "message": "Supply both latitude and longitude."})
    try:
        return read_window(latitude, longitude, width)
    except OutsideSite04Coverage as error:
        raise HTTPException(status_code=422, detail={"code": "OUTSIDE_SITE04_COVERAGE", "message": str(error)}) from error


@router.get("/terrain/site04/footprint", response_model=Site04Footprint)
def site04_footprint() -> Site04Footprint:
    # Densified perimeter, not a geographic bounding box (source contains the pole).
    points = []
    for start, end in [((-9000,1000),(7000,1000)),((7000,1000),(7000,-15000)),
                       ((7000,-15000),(-9000,-15000)),((-9000,-15000),(-9000,1000))]:
        for i in range(17):
            x = start[0] + (end[0]-start[0])*i/16
            y = start[1] + (end[1]-start[1])*i/16
            lat, lon = to_lat_lon(x,y)
            points.append(dict(latitude=lat,longitude=lon))
    lat, lon = to_lat_lon(-1000,-7000)
    return Site04Footprint(projected_bounds=dict(min_x=-9000,min_y=-15000,max_x=7000,max_y=1000),
        center=dict(latitude=lat,longitude=lon),boundary=points)
