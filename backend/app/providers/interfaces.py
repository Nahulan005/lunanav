from typing import Protocol

from app.schemas.analysis import (
    AnalysisRequest, EphemerisResult, ImageryResult, ProviderResult,
    TerrainResult, VisibilityResult,
)


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
