"""One bounded official LDEM_4 subset. Offline, fail-closed, no synthetic fallback.

The standard-library reader is specific to the audited SignedLSB2 product. It is
not a general PDS, Rasterio, coordinate transformation, or terrain analysis engine.
"""
import hashlib
import json
import math
from pathlib import Path
import struct

from app.schemas.analysis import AnalysisRequest, Provenance, ProviderResult, TerrainResult
from app.schemas.terrain import Coordinate, Pixel, SampleValidation, TerrainSampleResponse

BACKEND = Path(__file__).resolve().parents[2]
SOURCE_URL = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_4.img"


class TerrainSampleError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 503):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


class LolaTerrainProvider:
    def __init__(self, data_dir: Path | None = None):
        self.data_dir = data_dir if data_dir is not None else BACKEND / "data"

    def sample(self, latitude: float, longitude: float) -> TerrainSampleResponse:
        if not (math.isfinite(latitude) and math.isfinite(longitude) and
                -90 <= latitude <= 90 and -180 <= longitude <= 180):
            raise TerrainSampleError("INVALID_COORDINATE", "Finite latitude [-90,90] and east longitude [-180,180] required.", 422)
        try:
            return self._sample(latitude, longitude)
        except TerrainSampleError:
            raise
        except (OSError, ValueError, KeyError, TypeError, struct.error) as error:
            raise TerrainSampleError("LOLA_DATA_UNAVAILABLE", "LOLA subset or metadata is missing, inconsistent, or unreadable. Run scripts/prepare_lola_sample.py; no elevation was fabricated.") from error

    def _sample(self, latitude: float, longitude: float) -> TerrainSampleResponse:
        metadata = self.data_dir / "metadata"
        manifest_path = metadata / "lola_sample_manifest.json"
        if manifest_path.stat().st_size > 65536:
            raise TerrainSampleError("INVALID_METADATA", "LOLA manifest exceeds expected size.")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        raster = self.data_dir / "raw/ldem_4_apollo17_cutout.bin"
        expected = {
            "schema_version": 1, "product_name": "LDEM_4", "product_version": "V3.0",
            "source_url": SOURCE_URL, "scale_factor": 0.5, "elevation_offset_m": 0,
            "reference_radius_m": 1737400, "units": "m", "nodata_value": None,
            "pixel_scale_per_degree": 4, "local_bytes": 8192,
            "source_dn_min": -17758, "source_dn_max": 21008,
        }
        if any(manifest[key] != value for key, value in expected.items()):
            raise TerrainSampleError("UNSUPPORTED_PRODUCT", "Metadata differs from the audited LDEM_4 product.")
        crop = manifest["crop"]
        if [crop[key] for key in ("source_row_offset", "source_col_offset", "width", "height")] != [248, 96, 64, 64]:
            raise TerrainSampleError("UNSUPPORTED_SUBSET", "Subset dimensions differ from the audited cutout.")
        if manifest["crs"]["lunar_frame"] != "MEAN EARTH/POLAR AXIS OF DE421":
            raise TerrainSampleError("INCOMPATIBLE_FRAME", "Unexpected lunar frame.")
        for name in ("ldem_4.lbl", "ldem_4.xml"):
            label = metadata / name
            artifact = manifest["source_artifacts"][name]
            if label.stat().st_size != artifact["bytes"] or hashlib.sha256(label.read_bytes()).hexdigest() != artifact["sha256"]:
                raise TerrainSampleError("LABEL_CHECKSUM_MISMATCH", "Stored official label failed integrity checking.")
        if raster.stat().st_size != 8192:
            raise TerrainSampleError("INVALID_RASTER_LENGTH", "Expected exactly 8192 bytes of SignedLSB2 samples.")
        data = raster.read_bytes()
        checksum = hashlib.sha256(data).hexdigest()
        if checksum != manifest["local_sha256"]:
            raise TerrainSampleError("RASTER_CHECKSUM_MISMATCH", "LOLA cutout failed SHA-256 checking; no value returned.")

        # Native angular grid: exact label resolution, not rounded projected metres.
        source_row = math.floor((90 - latitude) * 4)
        source_col = math.floor((longitude % 360) * 4)
        row, col = source_row - 248, source_col - 96
        if not (0 <= row < 64 and 0 <= col < 64):
            raise TerrainSampleError("OUTSIDE_LOCAL_COVERAGE", "This sample covers 12 < latitude <= 28 and 24 <= longitude < 40 degrees east only.", 422)
        used_lat = 90 - (source_row + 0.5) / 4
        used_lon = (source_col + 0.5) / 4
        roundtrip = Pixel(row=math.floor((90 - used_lat) * 4), column=math.floor(used_lon * 4))
        if (roundtrip.row, roundtrip.column) != (source_row, source_col):
            raise TerrainSampleError("ROUNDTRIP_FAILED", "Pixel-center round trip failed; no elevation returned.")
        raw_dn = struct.unpack_from("<h", data, 2 * (row * 64 + col))[0]
        if not (-17758 <= raw_dn <= 21008):
            raise TerrainSampleError("INVALID_SAMPLE", "Sample outside source label extrema; nodata or corruption cannot be ruled out.")
        return TerrainSampleResponse(
            source_name=manifest["source_name"], source_url=SOURCE_URL,
            product_name="LDEM_4", product_version="V3.0",
            coordinate_requested=Coordinate(latitude=latitude, longitude=longitude),
            coordinate_used=Coordinate(latitude=used_lat, longitude=used_lon),
            coordinate_convention="planetocentric; east-positive longitude; API [-180,180], source [0,360)",
            coordinate_reference_system="Moon MEAN EARTH/POLAR AXIS OF DE421; simple cylindrical/equirectangular, central meridian 180 deg, standard parallel 0 deg, sphere radius 1737400 m; no Earth EPSG CRS",
            source_pixel=Pixel(row=source_row, column=source_col), subset_pixel=Pixel(row=row, column=col),
            raw_dn=raw_dn, scale_factor=0.5, elevation_offset_m=0.0,
            elevation_value=raw_dn * 0.5, reference_radius_m=1737400,
            checksum=manifest["source_artifacts"]["ldem_4.img"]["sha256"], subset_checksum=checksum,
            validation=SampleValidation(status="ingestion-verified-not-scientifically-validated",
                checks=manifest["validation"]["checks"] + ["runtime subset/label SHA-256", "runtime range and bounds"],
                coordinate_roundtrip_passed=True, roundtrip_source_pixel=roundtrip),
            limitations=manifest["limitations"] + [manifest["nodata_policy"]],
        )

    def get_terrain(self, request: AnalysisRequest) -> ProviderResult[TerrainResult]:
        """Satisfy TerrainProvider while explicitly leaving all unsampled properties absent."""
        sample = self.sample(request.latitude, request.longitude)
        return ProviderResult(value=TerrainResult(elevation_m=sample.elevation_value,
            vertical_datum="Height above 1737400 m reference sphere in DE421 ME frame",
            slope_deg=None, horizon=[], coverage="partial"),
            provenance=Provenance(mode="local-derived", provider=type(self).__name__,
                algorithm_version="ldem4-native-cell-v1", source_ids=["lola"], dataset_ids=["LDEM_4 V3.0"],
                assumptions=["Coordinate already in source lunar frame; containing grid cell used."],
                limitations=sample.limitations, validation="unvalidated"))
