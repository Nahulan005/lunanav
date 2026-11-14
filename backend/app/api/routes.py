from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.providers.mock import MockTerrainProvider, MockEphemerisProvider, MockImageryProvider, MockVisibilityAnalysisProvider
from app.schemas.analysis import AnalysisRequest, AnalysisResponse, HealthResponse
from app.services.analysis import AnalysisService
from app.providers.lola import LolaTerrainProvider, TerrainSampleError
from app.schemas.terrain import TerrainSampleResponse, TerrainProfile

router = APIRouter(prefix="/api/v1")


def get_analysis_service() -> AnalysisService:
    return AnalysisService(MockTerrainProvider(), MockEphemerisProvider(),
                           MockImageryProvider(), MockVisibilityAnalysisProvider())


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse()


@router.post("/analysis", response_model=AnalysisResponse)
def analyze(request: AnalysisRequest, service: Annotated[AnalysisService, Depends(get_analysis_service)]) -> AnalysisResponse:
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
        raise HTTPException(status_code=error.status_code,
                            detail={"code": error.code, "message": str(error)}) from error


@router.get("/terrain/profile", response_model=TerrainProfile)
def terrain_profile(
    latitude: Annotated[float, Query(ge=-90, le=90, allow_inf_nan=False)],
    longitude: Annotated[float, Query(ge=-180, le=180, allow_inf_nan=False)],
    provider: Annotated[LolaTerrainProvider, Depends(get_terrain_provider)],
) -> TerrainProfile:
    try:
        return provider.profile(latitude, longitude)
    except TerrainSampleError as error:
        raise HTTPException(status_code=error.status_code,
                            detail={"code": error.code, "message": str(error)}) from error
