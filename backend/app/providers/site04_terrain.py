"""Integrity-checked compact terrain artifact; no GIS imports at API runtime."""
import hashlib
from pathlib import Path
from app.schemas.site04_terrain import Site04TerrainResponse

ARTIFACT = Path(__file__).resolve().parents[2] / "data/processed/site04_terrain_window.json"
ARTIFACT_SHA256 = "af715a84f5b494d3e04c7c844bbd1ea9da913aff26e5ef0e93bdf30178fadb0c"


def get_site04_terrain() -> Site04TerrainResponse:
    try:
        with ARTIFACT.open("rb") as stream:
            data = stream.read(524289)
        if len(data) > 524288 or hashlib.sha256(data).hexdigest() != ARTIFACT_SHA256:
            raise ValueError("Artifact size/checksum mismatch")
        result = Site04TerrainResponse.model_validate_json(data)
        if result.status != "provisional" or len(result.cells) != 1024:
            raise ValueError("Unexpected artifact scope")
        return result
    except (OSError, ValueError):
        return Site04TerrainResponse(status="unavailable",
            detail="Site04 terrain artifact missing, invalid or failed integrity checking.",
            limitations=["No terrain cells or demo substitute returned.",
                "Reproduce with scripts/prepare_site04_terrain.py and the pinned external source files."])
