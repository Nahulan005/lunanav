"""Serve the pinned native Site04 coverage artifact without GIS runtime imports."""
import hashlib
from pathlib import Path
from pydantic import ValidationError
from app.schemas.site04_coverage import Site04CoverageResponse

ARTIFACT = Path(__file__).resolve().parents[2] / "data/processed/site04_coverage_window.json"
ARTIFACT_SHA256 = "63fe56171921c817a64de8e5be794f320ae9ceb10a711b57cd59fb866a691a67"


def get_site04_coverage() -> Site04CoverageResponse:
    try:
        with ARTIFACT.open("rb") as stream:
            data = stream.read(262145)
        if len(data) > 262144 or hashlib.sha256(data).hexdigest() != ARTIFACT_SHA256:
            raise ValueError("Artifact size/hash mismatch")
        result = Site04CoverageResponse.model_validate_json(data)
        if result.status != "provisional" or len(result.cells) != 1024:
            raise ValueError("Unexpected artifact scope")
        return result
    except (OSError, ValueError, ValidationError):
        return Site04CoverageResponse(
            detail="Prepared Site04 coverage artifact is missing, invalid, or failed integrity checking.",
            limitations=[
                "No cells returned; no synthetic or demo fallback.",
                "Reproduce the pinned artifact with scripts/prepare_site04_coverage.py and the documented source TIFF.",
                "Observation coverage is not elevation, risk, suitability or a recommendation.",
            ],
        )
