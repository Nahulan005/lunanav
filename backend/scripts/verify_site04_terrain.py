"""Bounded route, provenance, native alignment and fail-closed checks. No network."""
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from app.main import app
from app.providers import site04_terrain as provider
from app.providers.site04_coverage import get_site04_coverage


def main():
    with TestClient(app) as client:
        response = client.get("/api/v1/terrain/site04/grid")
        assert response.status_code == 200
        result = response.json()
        assert result["status"] == "provisional" and len(result["cells"]) == 1024
        coverage = get_site04_coverage()
        assert result["coordinate_system"] == coverage.coordinate_system.model_dump()
        assert result["returned_bounds"] == coverage.returned_bounds.model_dump()
        assert len(result["sources"]) == 5
        for terrain, count in zip(result["cells"], coverage.cells, strict=True):
            assert (terrain["row"], terrain["column"]) == (count.row, count.column)
            assert terrain["bounds"] == count.bounds.model_dump()
            assert terrain["observation_status"] == count.observation_status
            for key, unit in (("elevation", "m"), ("slope", "degree"), ("elevation_rms_uncertainty", "m"), ("slope_rms_uncertainty", "degree")):
                metric = terrain[key]
                assert metric["unit"] == unit
                assert (metric["value"] is not None) == (metric["status"] == "available")
        assert result["cells"][0]["elevation"]["value"] == 822.4229125976562
        with TemporaryDirectory() as directory:
            missing = Path(directory) / "missing.json"
            with patch.object(provider, "ARTIFACT", missing):
                unavailable = client.get("/api/v1/terrain/site04/grid").json()
                assert unavailable["status"] == "unavailable" and unavailable["cells"] == []
            missing.write_bytes(b"{}")
            with patch.object(provider, "ARTIFACT", missing):
                unavailable = client.get("/api/v1/terrain/site04/grid").json()
                assert unavailable["status"] == "unavailable" and unavailable["cells"] == []
        assert "/api/v1/terrain/site04/grid" in client.get("/openapi.json").json()["paths"]
    print("PASS: Site04 terrain route, 1024 aligned native cells, provenance, units, missing/corrupt fallback.")


if __name__ == "__main__":
    main()
