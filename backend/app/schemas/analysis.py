from datetime import date, datetime
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, populate_by_name=True)


class AnalysisRequest(Contract):
    site_id: str = Field(alias="siteId", min_length=1, max_length=80)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    landing_date: date = Field(alias="landingDate")
    duration_days: int = Field(default=7, ge=1, le=30, strict=True)
    observer_height_m: float = Field(default=2, ge=0, le=1000)
    coordinate_convention: Literal["planetocentric-east-positive-minus180-to180"] = "planetocentric-east-positive-minus180-to180"


class Provenance(Contract):
    mode: Literal["mock", "local-derived"]
    provider: str
    algorithm_version: str
    source_ids: list[str] = Field(default_factory=list)
    dataset_ids: list[str] = Field(default_factory=list)
    assumptions: list[str]
    limitations: list[str]
    validation: Literal["unvalidated", "benchmarked"] = "unvalidated"


T = TypeVar("T")


class ProviderResult(Contract, Generic[T]):
    value: T
    provenance: Provenance


class HorizonSample(Contract):
    azimuth_deg: float = Field(ge=0, lt=360)
    elevation_deg: float | None = Field(default=None, ge=-90, le=90)


class TerrainResult(Contract):
    elevation_m: float | None
    vertical_datum: str
    slope_deg: float | None = Field(ge=0, le=90)
    horizon: list[HorizonSample]
    coverage: Literal["fixture-only", "complete", "partial", "none"]


class Direction(Contract):
    azimuth_deg: float = Field(ge=0, lt=360)
    elevation_deg: float = Field(ge=-90, le=90)


class GeometrySample(Contract):
    utc: datetime
    sun: Direction
    earth_center: Direction


class EphemerisResult(Contract):
    samples: list[GeometrySample]
    frame: str
    kernel_ids: list[str]
    coverage: Literal["fixture-only", "complete", "partial", "none"]


class ImageryResult(Contract):
    local_asset_path: str | None
    product_id: str | None
    description: str


class VisibilitySample(Contract):
    utc: datetime
    sunlight: bool | None
    earth_geometric_visibility: bool | None


class VisibilityResult(Contract):
    samples: list[VisibilitySample]
    radio_communication: Literal["not-assessed"] = "not-assessed"
    coverage: Literal["fixture-only", "complete", "partial", "none"]


class SourceReference(Contract):
    id: str
    official_name: str
    official_url: str
    integration_status: str
    used_in_calculation: Literal[False] = False


class AnalysisResponse(Contract):
    schema_version: Literal["1.0"] = "1.0"
    mode: Literal["mock"] = "mock"
    request: AnalysisRequest
    terrain: ProviderResult[TerrainResult]
    imagery: ProviderResult[ImageryResult]
    ephemeris: ProviderResult[EphemerisResult]
    visibility: ProviderResult[VisibilityResult]
    mission_assessment: Literal["not-assessed"] = "not-assessed"
    warnings: list[str]
    source_references: list[SourceReference]


class HealthResponse(Contract):
    status: Literal["ok"] = "ok"
    service: Literal["lunanav-scientific-backend"] = "lunanav-scientific-backend"
    mode: Literal["mock", "hybrid"] = "hybrid"
    live_nasa_integrations: list[str] = Field(default_factory=list)
