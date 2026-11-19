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
from app.schemas.terrain import (
    Coordinate, Pixel, SampleValidation, TerrainSampleResponse, TerrainProfile,
    TerrainProfileSample, TerrainGridResolution, NeighborDirection,
)

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

    def profile(self, latitude: float, longitude: float) -> TerrainProfile:
        """Bounded cross profile; reuse sample() without altering its behavior."""
        center = self.sample(latitude, longitude)
        # sample() validates this specific LDEM_4 product at exactly 4 pixels/degree.
        step_deg = 0.25
        offsets: tuple[tuple[NeighborDirection, float, float], ...] = (
            ("north", step_deg, 0.0), ("east", 0.0, step_deg),
            ("south", -step_deg, 0.0), ("west", 0.0, -step_deg),
        )
        neighbors: list[TerrainProfileSample] = []
        missing: list[NeighborDirection] = []
        heights: dict[NeighborDirection, float] = {}
        for direction, latitude_offset, longitude_offset in offsets:
            try:
                neighbor = self.sample(
                    center.coordinate_used.latitude + latitude_offset,
                    center.coordinate_used.longitude + longitude_offset,
                )
            except TerrainSampleError as error:
                if error.code != "OUTSIDE_LOCAL_COVERAGE":
                    # Missing/corrupt files and invalid samples remain explicit errors.
                    raise
                missing.append(direction)
                continue
            if neighbor.checksum != center.checksum or neighbor.subset_checksum != center.subset_checksum:
                raise TerrainSampleError("DATA_CHANGED_DURING_PROFILE", "Source or subset changed while reading neighbors; no profile returned.")
            neighbors.append(TerrainProfileSample(
                direction=direction, coordinate_used=neighbor.coordinate_used,
                source_pixel=neighbor.source_pixel, subset_pixel=neighbor.subset_pixel,
                elevation_value=neighbor.elevation_value,
            ))
            heights[direction] = neighbor.elevation_value

        # Reference-sphere arc lengths; latitude-dependent east/west distance.
        # This estimates a coarse grid gradient, not within-cell terrain roughness.
        dy = center.reference_radius_m * math.radians(step_deg)
        dx = dy * math.cos(math.radians(center.coordinate_used.latitude))
        slope = None
        reason = None
        if missing:
            reason = "Central differences require north, east, south, and west neighbors; outside local coverage: " + ", ".join(missing) + ". No one-sided estimate is substituted."
        else:
            north_gradient = (heights["north"] - heights["south"]) / (2 * dy)
            east_gradient = (heights["east"] - heights["west"]) / (2 * dx)
            slope = math.degrees(math.atan(math.hypot(north_gradient, east_gradient)))

        elevations = [center.elevation_value] + [sample.elevation_value for sample in neighbors]
        # Keep original sample limitations separately; replace only statements that
        # describe the old single-cell scope in the profile's own limitations.
        limitations = [text for text in center.limitations if text not in (
            "One containing-cell sample; no interpolation or site-scale terrain analysis.",
            "No slope, horizon, SPICE, radio link, or landing-safety assessment.",
        )] + [
            "Only the center and available cardinal cells are sampled; no interpolation or region-wide extrema.",
            "Slope is an unvalidated central-difference grid-gradient estimate over two-cell baselines, not within-cell slope or roughness.",
            "Distances use the reference sphere and center latitude, not terrain-following distances.",
            "Missing cardinal neighbors produce null slope; corrupt or invalid data produces an error.",
            "No other terrain analyses or operational assessment are performed.",
        ]
        fields = center.model_dump()
        fields["limitations"] = limitations
        return TerrainProfile(
            **fields, neighbor_samples=neighbors, missing_neighbors=missing,
            sample_count=len(elevations), minimum_elevation=min(elevations),
            maximum_elevation=max(elevations), elevation_range=max(elevations) - min(elevations),
            slope_deg=slope, slope_reason=reason,
            grid_resolution=TerrainGridResolution(
                latitude_step_deg=step_deg, longitude_step_deg=step_deg,
                source_label_projected_spacing_m=7580.84,
                north_south_spacing_m=dy, east_west_spacing_m=dx,
                source_rows=720, source_columns=1440, subset_rows=64, subset_columns=64,
            ),
            provenance=Provenance(
                mode="local-derived", provider=type(self).__name__,
                algorithm_version="ldem4-cardinal-profile-v1", source_ids=["lola"],
                dataset_ids=["LDEM_4 V3.0"], validation="unvalidated",
                assumptions=[
                    "All samples reuse the existing audited cutout reader and height conversion.",
                    "Input coordinates already use the source lunar frame.",
                    "The containing cell center is used, preserving the sample endpoint's registration and boundary rules.",
                ], limitations=limitations,
            ), source_limitations=center.limitations,
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
