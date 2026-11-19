"""Bounded native Site04 terrain products; no suitability classification."""
from typing import Literal
from pydantic import Field
from app.schemas.analysis import Contract
from app.schemas.site04_coverage import CoverageBounds, CoverageCoordinateSystem, CoverageResolution


class TerrainValue(Contract):
    value: float | None
    unit: Literal["m", "degree"]
    status: Literal["available", "nodata", "unverified"]


class Site04TerrainCell(Contract):
    row: int = Field(ge=0)
    column: int = Field(ge=0)
    bounds: CoverageBounds
    center: "GeographicPoint | None" = None
    elevation: TerrainValue
    slope: TerrainValue
    elevation_rms_uncertainty: TerrainValue
    slope_rms_uncertainty: TerrainValue
    observation_status: Literal["observed", "unobserved", "nodata", "unverified"]


class TerrainProductSource(Contract):
    product: str
    url: str
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    bytes: int = Field(gt=0)


class GeographicPoint(Contract):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class Site04Selection(Contract):
    requested: GeographicPoint
    nearest_cell: GeographicPoint
    row: int
    column: int


class Site04Footprint(Contract):
    frame: str = "MOON_ME / DE421; spherical planetocentric, east-positive degrees"
    projected_bounds: CoverageBounds
    center: GeographicPoint
    boundary: list[GeographicPoint]
    limitation: str = "Raster footprint, not a guarantee of valid observations. Projection checked against GDAL/PROJ; absolute registration not independently surveyed."


class Site04TerrainResponse(Contract):
    schema_version: Literal["1.0"] = "1.0"
    site_id: Literal["Site04"] = "Site04"
    status: Literal["provisional", "unavailable"]
    detail: str
    sources: list[TerrainProductSource] = Field(default_factory=list)
    coordinate_system: CoverageCoordinateSystem | None = None
    native_resolution: CoverageResolution | None = None
    returned_resolution: CoverageResolution | None = None
    returned_bounds: CoverageBounds | None = None
    elevation_reference: str | None = None
    processing: str | None = None
    selection: Site04Selection | None = None
    mapping_status: str | None = None
    cells: list[Site04TerrainCell] = Field(default_factory=list, max_length=1024)
    limitations: list[str]


Site04TerrainCell.model_rebuild()
