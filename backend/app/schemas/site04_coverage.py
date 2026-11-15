"""Site04 coverage handoff contract. No TIFF ingestion or georeferencing yet."""
from typing import Literal
from pydantic import Field
from app.schemas.analysis import Contract


class CoverageBounds(Contract):
    """Axis-aligned bounds in coordinate_system units; never implicitly lat/lon."""
    min_x: float
    min_y: float
    max_x: float
    max_y: float


class CoverageCoordinateSystem(Contract):
    status: Literal["unverified", "verified"] = "unverified"
    frame: str | None = None
    crs_wkt: str | None = None
    projection: str | None = None
    coordinate_units: str | None = None
    axis_order: list[str] | None = None
    reference_surface: str | None = None
    pixel_registration: str | None = None
    affine_transform: list[float] | None = Field(default=None, min_length=6, max_length=6,
        description="GDAL geotransform order: x origin, column x step, row x step, y origin, column y step, row y step.")
    lat_lon_transform_verified: bool = False


class CoverageResolution(Contract):
    x_spacing: float = Field(gt=0)
    y_spacing: float = Field(gt=0)
    units: str
    rows: int = Field(gt=0)
    columns: int = Field(gt=0)


class CoverageSource(Contract):
    instrument: str = "NASA LRO / LOLA"
    instrument_url: str = "https://science.nasa.gov/mission/lro/lola/"
    expected_product: str = "Site04_ldec.tif"
    product_url: str | None = None
    sha256: str | None = None
    metadata_inspected: bool = False
    processing_version: str | None = None
    validation: Literal["not-inspected", "provisional", "ingestion-checked"] = "not-inspected"
    checks_completed: list[str] = Field(default_factory=list)


class CoverageSummary(Contract):
    status: Literal["unavailable", "provisional", "available"] = "unavailable"
    total_pixel_count: int | None = Field(default=None, ge=0)
    valid_pixel_count: int | None = Field(default=None, ge=0)
    observed_pixel_count: int | None = Field(default=None, ge=0)
    nodata_pixel_count: int | None = Field(default=None, ge=0)
    unverified_pixel_count: int | None = Field(default=None, ge=0)
    coverage_percentage: float | None = Field(default=None, ge=0, le=100)
    percentage_definition: str = "100 * observed_pixel_count / valid_pixel_count within returned bounds; null when denominator is zero or semantics are unverified."
    observation_rule: str | None = Field(default=None,
        description="Must come from inspected product documentation; no positive-value rule is assumed.")


class CoverageCell(Contract):
    row: int = Field(ge=0)
    column: int = Field(ge=0)
    bounds: CoverageBounds = Field(description="Verified source-frame bounds; no cell may be placed without verified alignment.")
    value: float | None = Field(description="Documented coverage value only; not elevation or suitability.")
    value_unit: str | None
    observation_status: Literal["observed", "unobserved", "nodata", "unverified"]


class CoverageLegendEntry(Contract):
    status: Literal["observed", "unobserved", "nodata", "unverified"]
    label: str
    color: str
    symbol: str


class Site04CoverageResponse(Contract):
    schema_version: Literal["1.0"] = "1.0"
    status: Literal["unavailable", "provisional", "available"] = "unavailable"
    layer: Literal["observation_coverage"] = "observation_coverage"
    site_id: Literal["Site04"] = "Site04"
    detail: str
    source: CoverageSource = Field(default_factory=CoverageSource)
    coordinate_system: CoverageCoordinateSystem = Field(default_factory=CoverageCoordinateSystem)
    value_unit: str | None = None
    native_resolution: CoverageResolution | None = None
    returned_resolution: CoverageResolution | None = None
    source_bounds: CoverageBounds | None = None
    returned_bounds: CoverageBounds | None = None
    nodata_value: float | None = Field(default=None,
        description="Null with nodata_status=unverified means unknown, not an assertion of no nodata.")
    nodata_status: Literal["unverified", "declared-sentinel", "mask-defined", "no-sentinel-declared"] = "unverified"
    summary: CoverageSummary = Field(default_factory=CoverageSummary)
    cells: list[CoverageCell] = Field(default_factory=list, max_length=4096)
    max_returned_cells: Literal[4096] = 4096
    legend: list[CoverageLegendEntry] = Field(default_factory=lambda: [
        CoverageLegendEntry(status="unverified", label="Unknown / unverified", color="#8899aa", symbol="?"),
        CoverageLegendEntry(status="nodata", label="Missing data", color="#8899aa", symbol="-"),
    ])
    limitations: list[str]
