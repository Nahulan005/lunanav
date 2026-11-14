"""Run from any directory: backend/.venv/Scripts/python.exe backend/scripts/verify_backend.py."""
import importlib
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from app.main import app, origins


def verify_terrain(client: TestClient) -> None:
    import json
    import shutil
    import tempfile
    from app.api.routes import get_terrain_provider
    from app.providers.lola import LolaTerrainProvider
    from app.schemas.analysis import AnalysisRequest

    backend = Path(__file__).resolve().parents[1]
    manifest = json.loads((backend / "data/metadata/lola_sample_manifest.json").read_text())
    demo = manifest["validation"]["demo"]
    response = client.get("/api/v1/terrain/sample", params=demo["requested"])
    assert response.status_code == 200, response.text
    sample = response.json()
    assert sample["mode"] == "local-derived"
    assert sample["elevation_value"] == demo["elevation_m"]
    assert sample["raw_dn"] == demo["raw_dn"]
    assert sample["coordinate_used"] == demo["used"]
    assert sample["checksum"] == manifest["source_artifacts"]["ldem_4.img"]["sha256"]
    assert sample["subset_checksum"] == manifest["local_sha256"]
    assert sample["validation"]["coordinate_roundtrip_passed"]
    assert not sample["validation"]["scientific_accuracy_validated"]
    assert sample["nodata_status"] == "not-flagged-no-sentinel-declared"
    assert sample["elevation_value"] == sample["raw_dn"] * 0.5
    for coordinate in ({"latitude": -89.9, "longitude": 0}, {"latitude": 12, "longitude": 30},
                       {"latitude": 20, "longitude": 40}, {"latitude": 91, "longitude": 30},
                       {"latitude": "nan", "longitude": 30}, {"latitude": 20, "longitude": "inf"}):
        assert client.get("/api/v1/terrain/sample", params=coordinate).status_code == 422
    assert client.get("/api/v1/terrain/sample", params={"latitude": 28, "longitude": 24}).status_code == 200
    result = LolaTerrainProvider().get_terrain(AnalysisRequest(siteId="demo", landingDate="2027-03-15", **demo["requested"]))
    assert result.provenance.mode == "local-derived" and result.value.slope_deg is None
    assert result.value.horizon == [] and result.provenance.validation == "unvalidated"

    # A damaged or missing raster must fail closed, never yield a mock elevation.
    with tempfile.TemporaryDirectory() as directory:
        data_dir = Path(directory)
        app.dependency_overrides[get_terrain_provider] = lambda: LolaTerrainProvider(data_dir)
        try:
            assert client.get("/api/v1/terrain/sample", params=demo["requested"]).status_code == 503
            shutil.copytree(backend / "data/metadata", data_dir / "metadata")
            (data_dir / "raw").mkdir()
            binary = bytearray((backend / "data/raw/ldem_4_apollo17_cutout.bin").read_bytes())
            binary[0] ^= 1
            (data_dir / "raw/ldem_4_apollo17_cutout.bin").write_bytes(binary)
            corrupted = client.get("/api/v1/terrain/sample", params=demo["requested"])
            assert corrupted.status_code == 503
            assert corrupted.json()["detail"]["code"] == "RASTER_CHECKSUM_MISMATCH"
        finally:
            app.dependency_overrides.pop(get_terrain_provider, None)
    print("PASS: real LOLA sample, provenance, scaling, coordinate boundaries, missing/corrupt-data errors.")


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
                assert json.load(response)["mode"] == "mock"
            print("PASS: Uvicorn started and served HTTP health on loopback.")
            with urlopen(f"http://127.0.0.1:{port}/api/v1/terrain/sample?latitude=20.19&longitude=30.77", timeout=5) as response:
                assert response.status == 200
                sample = json.load(response)
                assert sample["mode"] == "local-derived" and sample["checksum"]
                assert sample["validation"]["coordinate_roundtrip_passed"]
                output = Path(__file__).resolve().parents[1] / "data/metadata/terrain_sample_response.json"
                output.write_text(json.dumps(sample, indent=2) + "\n", encoding="utf-8")
                print(f"PASS: real HTTP terrain sample: {sample['elevation_value']} m; response saved to {output.name}.")
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
        assert health.json()["mode"] == "mock"
        assert health.json()["live_nasa_integrations"] == []
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
        paths = client.get("/openapi.json").json()["paths"]
        assert "get" in paths["/api/v1/health"] and "post" in paths["/api/v1/analysis"]
        if origins:
            preflight = client.options("/api/v1/analysis", headers={
                "Origin": origins[0], "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type"})
            assert preflight.status_code == 200
            assert preflight.headers["access-control-allow-origin"] == origins[0]
        rejected = client.options("/api/v1/analysis", headers={
            "Origin": "https://unconfigured.invalid", "Access-Control-Request-Method": "POST"})
        assert "access-control-allow-origin" not in rejected.headers
        verify_terrain(client)
    print("PASS: imports, health, analysis, validation, mock provenance, source registry, OpenAPI, and CORS.")


if __name__ == "__main__":
    main()
    if "--http" in sys.argv:
        verify_http()
