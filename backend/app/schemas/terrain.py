from typing import Literal
from pydantic import Field
from app.schemas.analysis import Contract


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
