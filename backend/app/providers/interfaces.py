from datetime import date
from typing import Protocol

from app.schemas.analysis import (
    AnalysisRequest, EphemerisResult, ImageryResult, ProviderResult,
    TerrainResult, VisibilityResult,
)
from app.schemas.geometry import SunEarthGeometryResponse


class TerrainProvider(Protocol):
    def get_terrain(self, request: AnalysisRequest) -> ProviderResult[TerrainResult]: ...


class EphemerisProvider(Protocol):
    def get_geometry(self, request: AnalysisRequest) -> ProviderResult[EphemerisResult]: ...


class ImageryProvider(Protocol):
    def get_imagery(self, request: AnalysisRequest) -> ProviderResult[ImageryResult]: ...


class VisibilityAnalysisProvider(Protocol):
    def analyze(
        self, request: AnalysisRequest, terrain: ProviderResult[TerrainResult],
        ephemeris: ProviderResult[EphemerisResult],
    ) -> ProviderResult[VisibilityResult]: ...


class SunEarthGeometryProvider(Protocol):
    def get_sun_earth_geometry(
        self,
        site_id: str,
        latitude: float,
        longitude: float,
        target_date: date,
        observer_height_m: float = 2.0,
    ) -> SunEarthGeometryResponse: ...
