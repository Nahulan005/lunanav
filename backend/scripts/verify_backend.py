"""Run from any directory: backend/.venv/Scripts/python.exe backend/scripts/verify_backend.py."""
import importlib
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from app.main import app, origins


def assert_health(data: dict) -> None:
    """Check capability metadata without claiming external-service availability."""
    assert {"status", "service", "mode", "live_nasa_integrations"} <= data.keys()
    assert data["status"] == "ok"
    assert data["service"] == "lunanav-scientific-backend"
    assert data["mode"] in ("mock", "hybrid")
    integrations = data["live_nasa_integrations"]
    assert isinstance(integrations, list)
    assert all(isinstance(item, str) for item in integrations)
    assert len(integrations) == len(set(integrations))
    if data["mode"] == "mock":
        assert integrations == []
        return

    from app.api.routes import get_geometry_provider, get_terrain_provider
    from app.providers.lola import TerrainSampleError

    expected = []
    try:
        # Uses the unchanged reader, including its label and raster checksums.
        get_terrain_provider().sample(20.19, 30.77)
    except TerrainSampleError:
        pass  # Failed local integrity must not be advertised as an active dataset.
    else:
        expected.append("LOLA: local dataset (integrity checked; not a live NASA service)")
    if get_geometry_provider().enable_network:
        expected.append("JPL Horizons: live API enabled (reachability not checked)")
    assert integrations == expected, "Health must distinguish local data from configured network capability"


def verify_site04(client: TestClient) -> None:
    """Check the pinned native grid and fail-closed behavior, without GIS/network."""
    from collections import Counter
    import hashlib
    from unittest.mock import patch
    import app.providers.site04_coverage as provider

    response = client.get("/api/v1/terrain/site04/coverage")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["status"] == "provisional", data["detail"]
    assert data["layer"] == "observation_coverage"
    assert data["source"]["metadata_inspected"] is True
    assert data["source"]["validation"] == "provisional"
    assert data["source"]["sha256"] == "fcc8c2219ae2368d5b2a1f6aec05fcf96cf725f3035ac8d80efc312a4ff29227"
    assert hashlib.sha256(provider.ARTIFACT.read_bytes()).hexdigest() == provider.ARTIFACT_SHA256
    assert data["coordinate_system"]["lat_lon_transform_verified"] is False
    assert data["coordinate_system"]["coordinate_units"] == "m"
    transform = data["coordinate_system"]["affine_transform"]
    assert transform == [-9000, 5, 0, 1000, 0, -5]
    assert data["returned_resolution"] == dict(x_spacing=5, y_spacing=5, units="m", rows=32, columns=32)
    assert data["returned_bounds"] == dict(min_x=-1080, min_y=-7080, max_x=-920, max_y=-6920)
    cells = data["cells"]
    assert len(cells) == 1024 <= data["max_returned_cells"]
    assert len({(c["row"], c["column"]) for c in cells}) == 1024
    for c in cells:
        row, col = c["row"], c["column"]
        assert 1584 <= row <= 1615 and 1584 <= col <= 1615
        assert c["bounds"] == dict(min_x=-9000 + col*5, max_x=-9000 + (col+1)*5,
                                   min_y=1000 - (row+1)*5, max_y=1000 - row*5)
        assert c["value_unit"] == "LOLA returns per pixel"
        status, value = c["observation_status"], c["value"]
        if status == "observed":
            assert value is not None and value > 0 and float(value).is_integer()
        elif status == "unobserved":
            assert value == 0
        else:
            assert status in ("nodata", "unverified") and value is None
    counts = Counter(c["observation_status"] for c in cells)
    assert counts == {"observed": 88, "unobserved": 936}
    summary = data["summary"]
    assert summary["total_pixel_count"] == summary["valid_pixel_count"] == 1024
    assert summary["observed_pixel_count"] == 88
    assert summary["nodata_pixel_count"] == summary["unverified_pixel_count"] == 0
    assert summary["coverage_percentage"] == 8.59375
    assert {entry["status"] for entry in data["legend"]} == {"observed", "unobserved", "nodata", "unverified"}
    assert data["nodata_status"] == "mask-defined" and data["nodata_value"] is None
    assert data["limitations"]
    for target, replacement in (("ARTIFACT", provider.ARTIFACT.with_name("missing-verification-artifact.json")),
                                ("ARTIFACT_SHA256", "0" * 64)):
        with patch.object(provider, target, replacement):
            failed = client.get("/api/v1/terrain/site04/coverage")
            assert failed.status_code == 200
            assert failed.json()["status"] == "unavailable" and failed.json()["cells"] == []
    assert not any(name in sys.modules for name in ("rasterio", "osgeo")), "API must not need GIS runtime"
    print("PASS: Site04 1024 native cells, bounds, counts, provenance, checksum and missing/corrupt fallback.")


def verify_http() -> None:
    """Start Uvicorn on an ephemeral loopback port and stop it after a health probe."""
    import json
    import socket
    import threading
    import time
    from urllib.request import urlopen
    import uvicorn

    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", log_level="error"))
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
        thread = threading.Thread(target=server.run, kwargs={"sockets": [listener]}, daemon=True)
        thread.start()
        try:
            deadline = time.monotonic() + 10
            while not server.started and thread.is_alive() and time.monotonic() < deadline:
                time.sleep(0.05)
            assert server.started, "Uvicorn did not start"
            with urlopen(f"http://127.0.0.1:{port}/api/v1/health", timeout=5) as response:
                assert response.status == 200
                assert_health(json.load(response))
            print("PASS: Uvicorn started and served HTTP health on loopback.")
        finally:
            server.should_exit = True
            thread.join(timeout=5)
            assert not thread.is_alive(), "Verification server did not stop"


def main() -> None:
    for module in ("app.main", "app.schemas.analysis", "app.providers.interfaces",
                   "app.providers.mock", "app.services.analysis", "app.api.routes"):
        importlib.import_module(module)
    payload = {"siteId": "shackleton", "latitude": -89.9, "longitude": 0, "landingDate": "2027-03-15"}
    with TestClient(app) as client:
        health = client.get("/api/v1/health")
        assert health.status_code == 200
        assert_health(health.json())
        response = client.post("/api/v1/analysis", json=payload)
        assert response.status_code == 200, response.text
        result = response.json()
        assert result["mode"] == "mock"
        assert result["request"]["siteId"] == "shackleton"
        assert result["mission_assessment"] == "not-assessed"
        assert result["visibility"]["value"]["radio_communication"] == "not-assessed"
        assert len(result["source_references"]) == 5
        assert all(not source["used_in_calculation"] for source in result["source_references"])
        for key in ("terrain", "imagery", "ephemeris", "visibility"):
            assert result[key]["provenance"]["mode"] == "mock"
            assert result[key]["provenance"]["source_ids"] == []
            assert result[key]["provenance"]["dataset_ids"] == []
        assert result["ephemeris"]["value"]["kernel_ids"] == []
        for invalid in ({"latitude": 91}, {"longitude": -181}, {"landingDate": "invalid"},
                        {"duration_days": 0}, {"duration_days": 31}, {"duration_days": 1.5},
                        {"observer_height_m": -1}, {"unknown": True}):
            assert client.post("/api/v1/analysis", json={**payload, **invalid}).status_code == 422
        assert client.post("/api/v1/analysis", json={}).status_code == 422
        assert client.get("/api/v1/analysis").status_code == 405
        changed = client.post("/api/v1/analysis", json={**payload, "latitude": 20, "longitude": 30}).json()
        assert changed["terrain"] == result["terrain"], "Mocks must not imply coordinate calculations"
        verify_site04(client)
        paths = client.get("/openapi.json").json()["paths"]
        assert "get" in paths["/api/v1/terrain/site04/coverage"]
        assert "get" in paths["/api/v1/health"] and "post" in paths["/api/v1/analysis"]
        for origin in origins:
            for method in ("GET", "POST", "OPTIONS"):
                preflight = client.options("/api/v1/analysis", headers={
                    "Origin": origin, "Access-Control-Request-Method": method,
                    "Access-Control-Request-Headers": "Content-Type, Authorization"})
                assert preflight.status_code == 200, (origin, method, preflight.text)
                assert preflight.headers["access-control-allow-origin"] == origin
                assert "access-control-allow-credentials" not in preflight.headers
                allowed = preflight.headers["access-control-allow-headers"].lower()
                assert "content-type" in allowed and "authorization" in allowed
        rejected = client.options("/api/v1/analysis", headers={
            "Origin": "https://unconfigured.invalid", "Access-Control-Request-Method": "POST"})
        assert "access-control-allow-origin" not in rejected.headers
    print("PASS: imports, health, analysis, validation, mock provenance, source registry, OpenAPI, and CORS.")


if __name__ == "__main__":
    main()
    if "--http" in sys.argv:
        verify_http()
