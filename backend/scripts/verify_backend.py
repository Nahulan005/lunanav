"""Run from any directory: backend/.venv/Scripts/python.exe backend/scripts/verify_backend.py."""
import importlib
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from app.main import app, origins


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
    print("PASS: imports, health, analysis, validation, mock provenance, source registry, OpenAPI, and CORS.")


if __name__ == "__main__":
    main()
    if "--http" in sys.argv:
        verify_http()
