from typing import Literal
from pydantic import Field
from app.schemas.analysis import Contract, Provenance


class Coordinate(Contract):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class Pixel(Contract):
    row: int = Field(ge=0)
    column: int = Field(ge=0)


class SampleValidation(Contract):
    status: Literal["ingestion-verified-not-scientifically-validated"]
    checks: list[str]
    coordinate_roundtrip_passed: bool
    roundtrip_source_pixel: Pixel
    scientific_accuracy_validated: Literal[False] = False


class TerrainSampleResponse(Contract):
    mode: Literal["local-derived"] = "local-derived"
    source_name: str
    source_url: str
    product_name: str
    product_version: str
    coordinate_requested: Coordinate
    coordinate_used: Coordinate
    coordinate_convention: str
    coordinate_reference_system: str
    sampling_method: Literal["containing native grid cell; no interpolation"] = "containing native grid cell; no interpolation"
    source_pixel: Pixel
    subset_pixel: Pixel
    raw_dn: int
    scale_factor: float
    elevation_offset_m: float
    elevation_value: float
    units: Literal["m"] = "m"
    reference_radius_m: float
    nodata_value: None = None
    nodata_status: Literal["not-flagged-no-sentinel-declared"] = "not-flagged-no-sentinel-declared"
    checksum_algorithm: Literal["SHA-256"] = "SHA-256"
    checksum: str
    subset_checksum: str
    validation: SampleValidation
    limitations: list[str]


NeighborDirection = Literal["north", "east", "south", "west"]


class TerrainProfileSample(Contract):
    direction: NeighborDirection
    coordinate_used: Coordinate
    source_pixel: Pixel
    subset_pixel: Pixel
    elevation_value: float
    units: Literal["m"] = "m"


class TerrainGridResolution(Contract):
    latitude_step_deg: float = Field(gt=0)
    longitude_step_deg: float = Field(gt=0)
    source_label_projected_spacing_m: float = Field(gt=0)
    north_south_spacing_m: float = Field(gt=0)
    east_west_spacing_m: float = Field(gt=0)
    source_rows: int = Field(gt=0)
    source_columns: int = Field(gt=0)
    subset_rows: int = Field(gt=0)
    subset_columns: int = Field(gt=0)


class TerrainProfile(TerrainSampleResponse):
    """Existing center sample plus at most four native cardinal neighbors."""
    profile_method: Literal["center-and-four-cardinal-neighbors"] = "center-and-four-cardinal-neighbors"
    neighbor_samples: list[TerrainProfileSample]
    missing_neighbors: list[NeighborDirection]
    sample_count: int = Field(ge=1, le=5)
    minimum_elevation: float
    maximum_elevation: float
    elevation_range: float = Field(ge=0)
    statistics_scope: Literal["center and available cardinal neighbors only"] = "center and available cardinal neighbors only"
    slope_deg: float | None = Field(ge=0, le=90)
    slope_reason: str | None
    slope_method: Literal["central-difference gradient on reference sphere"] = "central-difference gradient on reference sphere"
    grid_resolution: TerrainGridResolution
    provenance: Provenance
    source_limitations: list[str]
