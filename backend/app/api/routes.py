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