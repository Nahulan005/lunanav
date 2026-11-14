"""Verification script for LunaNav JPL Horizons Sun/Earth Geometry Provider.

Run with:
backend/.venv/Scripts/python.exe backend/scripts/verify_geometry.py
"""
from datetime import date, datetime, timezone
import json
from pathlib import Path
import sys
from unittest.mock import patch

sys.stdout.reconfigure(line_buffering=True)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from app.main import app
from app.providers.horizons import (
    HorizonsApiError,
    HorizonsParsingError,
    JplHorizonsGeometryProvider,
)
from app.schemas.geometry import (
    HorizonsPreparedRequest,
    SunEarthGeometryResponse,
    SunEarthObservation,
    TargetDirection,
)


SAMPLE_SUN_HORIZONS_OUTPUT = """
*******************************************************************************
 Revised: July 31, 2013                  Sun                                 10
 Target body name: Sun (10)                        {source: DE441}
 Center body name: Moon (301)                      {source: DE441}
 Center-site name: (user defined site below)
 Center geodetic : 0.0, -89.9, 0.002               {E-lon(deg),Lat(deg),Alt(km)}
 Center cylindric: 0.0, 3.03233, -1737.4           {E-lon(deg),Dxy(km),Dz(km)}
 Center pole/equ : MEAN_ME (high precision)        {East-longitude positive}
 Center radii    : 1737.4, 1737.4, 1737.4 km       {Equator_a, b, pole_c}
*******************************************************************************
 Date__(UT)__HR:MN     R.A._____(ICRF)_____DEC  Azi____(a-app)___Elev
*********************************************************************
$$SOE
 2027-Mar-15 00:00  i  23 36 43.83 -02 31 41.1   94.748548  -0.860026
 2027-Mar-16 00:00  i  23 40 23.41 -02 07 55.1   82.568842  -0.865734
$$EOE
*******************************************************************************
"""

SAMPLE_EARTH_HORIZONS_OUTPUT = """
*******************************************************************************
 Target body name: Earth (399)                     {source: DE441}
 Center body name: Moon (301)                      {source: DE441}
 Center-site name: (user defined site below)
 Center geodetic : 0.0, -89.9, 0.002               {E-lon(deg),Lat(deg),Alt(km)}
 Center pole/equ : MEAN_ME (high precision)        {East-longitude positive}
 Center radii    : 1737.4, 1737.4, 1737.4 km       {Equator_a, b, pole_c}
*******************************************************************************
 Date__(UT)__HR:MN     R.A._____(ICRF)_____DEC  Azi____(a-app)___Elev
*********************************************************************
$$SOE
 2027-Mar-15 00:00  i  16 52 12.99 -26 59 49.2  356.066377   5.914675
 2027-Mar-16 00:00  i  17 55 11.72 -27 11 50.3  356.932968   5.028000
$$EOE
*******************************************************************************
"""


class MockHttpResponse:
    """Mock HTTP response reader for testing payload and parsing edge cases."""

    def __init__(self, data: bytes):
        self._data = data
        self._pos = 0

    def read(self, amt: int = -1) -> bytes:
        if amt == -1:
            res = self._data[self._pos:]
            self._pos = len(self._data)
            return res
        res = self._data[self._pos : self._pos + amt]
        self._pos += len(res)
        return res

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


def test_imports():
    from app.providers.interfaces import SunEarthGeometryProvider
    from app.providers.horizons import JplHorizonsGeometryProvider
    from app.schemas.geometry import SunEarthGeometryResponse
    print("PASS: Import checks passed.")


def test_schema_validation():
    direction = TargetDirection(
        azimuth_deg=94.748548,
        elevation_deg=-0.860026,
        right_ascension="23 36 43.83",
        declination="-02 31 41.1",
    )
    obs = SunEarthObservation(
        timestamp_utc=datetime(2027, 3, 15, 0, 0, tzinfo=timezone.utc),
        sun=direction,
        earth=direction,
        reference_frame="MEAN_ME (Lunar mean Earth)",
        reference_ellipsoid="Sphere radius 1737.4 km",
    )
    req = HorizonsPreparedRequest(
        api_url="https://ssd.jpl.nasa.gov/api/horizons.api",
        http_method="GET",
        sun_parameters={"COMMAND": "'10'"},
        earth_parameters={"COMMAND": "'399'"},
    )
    resp = SunEarthGeometryResponse(
        status="available",
        requested_site_id="shackleton",
        requested_latitude=-89.9,
        requested_longitude=0.0,
        requested_date=date(2027, 3, 15),
        request_parameters=req,
        live_request_executed=True,
        limitation_explanation=["Test limitation"],
        observation=obs,
    )
    dumped = resp.model_dump()
    assert dumped["status"] == "available"
    assert dumped["observation"]["sun"]["azimuth_deg"] == 94.748548
    print("PASS: Schema validation passed.")




def test_parser_with_sample_fixtures():
    provider = JplHorizonsGeometryProvider(enable_network=False)

    sun_records = provider._parse_horizons_text(
        SAMPLE_SUN_HORIZONS_OUTPUT, expected_target="Sun (10)"
    )

    assert len(sun_records) == 2

    sun_dir, dt, solar, interfering = sun_records[0]

    assert sun_dir.azimuth_deg == 94.748548
    assert sun_dir.elevation_deg == -0.860026
    assert sun_dir.right_ascension == "23 36 43.83"
    assert sun_dir.declination == "-02 31 41.1"
    assert dt == datetime(2027, 3, 15, 0, 0, tzinfo=timezone.utc)
    assert interfering == "i"
    assert solar is None

    assert sun_records[1][1] == datetime(
        2027, 3, 16, 0, 0, tzinfo=timezone.utc
    )

    earth_records = provider._parse_horizons_text(
        SAMPLE_EARTH_HORIZONS_OUTPUT, expected_target="Earth (399)"
    )

    assert len(earth_records) == 2

    earth_dir, _, _, _ = earth_records[0]

    assert earth_dir.azimuth_deg == 356.066377
    assert earth_dir.elevation_deg == 5.914675

    assert earth_records[0][1] == sun_records[0][1]
    assert earth_records[1][1] == sun_records[1][1]

    print("PASS: Multi-record parser logic verified against sample fixtures.")



def test_malformed_handling():
    provider = JplHorizonsGeometryProvider(enable_network=False)
    # 1. Missing delimiters
    try:
        provider._parse_horizons_text("No ephemeris block here", "Sun (10)")
        assert False, "Should have raised HorizonsParsingError"
    except HorizonsParsingError:
        pass

    # 2. Wrong target confirmation
    try:
        provider._parse_horizons_text(SAMPLE_EARTH_HORIZONS_OUTPUT, "Sun (10)")
        assert False, "Should have raised HorizonsParsingError for mismatched target"
    except HorizonsParsingError:
        pass

    # 3. Empty data block
    try:
        provider._parse_horizons_text("$$SOE\n$$EOE\nSun (10)\nMoon (301)", "Sun (10)")
        assert False, "Should have raised HorizonsParsingError for empty records"
    except HorizonsParsingError:
        pass

    # 4. Live malformed JSON handling: catches json.JSONDecodeError and returns structured unavailable
    live_provider = JplHorizonsGeometryProvider(enable_network=True)
    with patch("urllib.request.urlopen", return_value=MockHttpResponse(b"<html>Bad Gateway 502</html>")):
        res_malformed = live_provider.get_sun_earth_geometry(
            site_id="shackleton",
            latitude=-89.9,
            longitude=0.0,
            target_date=date(2027, 3, 15),
        )
        assert res_malformed.status == "unavailable"
        assert res_malformed.live_request_executed is True
        assert res_malformed.observation is None
        assert "malformed JSON" in res_malformed.detail

    # 5. Live oversized payload handling: catches HorizonsParsingError raised inside _execute_query
    with patch("urllib.request.urlopen", return_value=MockHttpResponse(b"A" * 300000)):
        res_oversized = live_provider.get_sun_earth_geometry(
            site_id="shackleton",
            latitude=-89.9,
            longitude=0.0,
            target_date=date(2027, 3, 15),
        )
        assert res_oversized.status == "unavailable"
        assert res_oversized.live_request_executed is True
        assert res_oversized.observation is None
        assert "exceeded 256KB safety limit" in res_oversized.detail

    # 6. Live non-dictionary JSON handling: catches HorizonsParsingError raised inside _execute_query
    with patch("urllib.request.urlopen", return_value=MockHttpResponse(b"[1, 2, 3]")):
        res_nondict = live_provider.get_sun_earth_geometry(
            site_id="shackleton",
            latitude=-89.9,
            longitude=0.0,
            target_date=date(2027, 3, 15),
        )
        assert res_nondict.status == "unavailable"
        assert res_nondict.live_request_executed is True
        assert res_nondict.observation is None
        assert "non-dictionary JSON" in res_nondict.detail

    print("PASS: Malformed response, invalid JSON, and oversized payload handling passed.")


def test_unsupported_configurations():
    provider = JplHorizonsGeometryProvider(enable_network=False)

    # 1. Year outside range
    res = provider.get_sun_earth_geometry(
        site_id="shackleton",
        latitude=-89.9,
        longitude=0.0,
        target_date=date(1700, 1, 1),
    )
    assert res.status == "unsupported"
    assert res.live_request_executed is False
    assert res.observation is None
    assert "outside LunaNav's currently configured supported date range" in res.detail

    # 2. Lat outside range
    res = provider.get_sun_earth_geometry(
        site_id="custom",
        latitude=-95.0,
        longitude=0.0,
        target_date=date(2027, 3, 15),
    )
    assert res.status == "unsupported"
    assert res.observation is None

    # 3. Network disabled -> unavailable (never fabricate mock geometry)
    res = provider.get_sun_earth_geometry(
        site_id="shackleton",
        latitude=-89.9,
        longitude=0.0,
        target_date=date(2027, 3, 15),
    )
    assert res.status == "unavailable"
    assert res.observation is None
    assert "Live network access is disabled" in res.detail

    print("PASS: Unsupported configuration handling passed.")


def test_timeout_and_network_failure():
    # Use an invalid loopback port to trigger connection error
    provider = JplHorizonsGeometryProvider(
        api_url="http://127.0.0.1:59999/api/horizons.api",
        timeout_seconds=1.0,
        enable_network=True,
    )
    res = provider.get_sun_earth_geometry(
        site_id="shackleton",
        latitude=-89.9,
        longitude=0.0,
        target_date=date(2027, 3, 15),
    )
    assert res.status == "unavailable"
    assert res.live_request_executed is True
    assert res.observation is None
    assert "failed or timed out" in res.detail
    print("PASS: Network timeout / connection failure handling passed.")


def test_api_routes_and_openapi():
    with TestClient(app) as client:
        # 1. Verify OpenAPI schema contains all 4 routes
        openapi = client.get("/openapi.json").json()
        paths = openapi["paths"]
        assert "/api/v1/health" in paths
        assert "/api/v1/analysis" in paths
        assert "/api/v1/terrain/sample" in paths
        assert "/api/v1/geometry/sun-earth" in paths

        # 2. Verify health route
        h_resp = client.get("/api/v1/health")
        assert h_resp.status_code == 200
        assert h_resp.json()["status"] == "ok"

        # 3. Verify POST /analysis unchanged
        a_resp = client.post(
            "/api/v1/analysis",
            json={
                "siteId": "shackleton",
                "latitude": -89.9,
                "longitude": 0,
                "landingDate": "2027-03-15",
            },
        )
        assert a_resp.status_code == 200
        assert a_resp.json()["mode"] == "mock"

        # 4. Verify GET /geometry/sun-earth validation
        # Missing date -> 422
        bad_req = client.get("/api/v1/geometry/sun-earth?latitude=-89.9&longitude=0")
        assert bad_req.status_code == 422

        # Latitude out of range -> 422
        bad_lat = client.get(
            "/api/v1/geometry/sun-earth?latitude=999&longitude=0&landingDate=2027-03-15"
        )
        assert bad_lat.status_code == 422

        # Valid call via test client
        # In sandboxed / offline test, live query might succeed or return unavailable
        g_resp = client.get(
            "/api/v1/geometry/sun-earth?siteId=shackleton&latitude=-89.9&longitude=0&landingDate=2027-03-15"
        )
        assert g_resp.status_code == 200
        data = g_resp.json()
        assert data["status"] in ("available", "unavailable", "unsupported")
        assert data["requested_site_id"] == "shackleton"
        assert data["requested_latitude"] == -89.9
        assert data["requested_longitude"] == 0.0
        assert data["requested_date"] == "2027-03-15"
        assert "request_parameters" in data
        assert "sun_parameters" in data["request_parameters"]
        assert "earth_parameters" in data["request_parameters"]
        assert "limitation_explanation" in data
        assert len(data["limitation_explanation"]) >= 5

        # Check alternative query parameter name 'date'
        g_resp_alt = client.get(
            "/api/v1/geometry/sun-earth?latitude=20.19&longitude=30.77&date=2027-03-15"
        )
        assert g_resp_alt.status_code == 200
        assert g_resp_alt.json()["requested_date"] == "2027-03-15"

        # 5. Route handling for malformed JSON returns 200 with structured unavailable (never 500)
        with patch(
            "urllib.request.urlopen",
            return_value=MockHttpResponse(b"<html>Bad Gateway 502</html>"),
        ):
            r = client.get(
                "/api/v1/geometry/sun-earth?latitude=-89.9&longitude=0&landingDate=2027-03-15"
            )
            assert r.status_code == 200
            body = r.json()
            assert body["status"] == "unavailable"
            assert "malformed JSON" in body["detail"]

        # 6. Route handling for oversized payload returns 200 with structured unavailable (never 500)
        with patch(
            "urllib.request.urlopen",
            return_value=MockHttpResponse(b"A" * 300000),
        ):
            r = client.get(
                "/api/v1/geometry/sun-earth?latitude=-89.9&longitude=0&landingDate=2027-03-15"
            )
            assert r.status_code == 200
            body = r.json()
            assert body["status"] == "unavailable"
            assert "256KB safety limit" in body["detail"]

        # 7. Route handling with valid mock fixtures returns 200 with available observation
        sun_resp = json.dumps({"result": SAMPLE_SUN_HORIZONS_OUTPUT}).encode()
        earth_resp = json.dumps({"result": SAMPLE_EARTH_HORIZONS_OUTPUT}).encode()
        with patch(
            "urllib.request.urlopen",
            side_effect=[MockHttpResponse(sun_resp), MockHttpResponse(earth_resp)],
        ):
            r = client.get(
                "/api/v1/geometry/sun-earth?latitude=-89.9&longitude=0&landingDate=2027-03-15"
            )
            assert r.status_code == 200
            body = r.json()
            assert body["status"] == "available"
            assert body["observation"]["sun"]["azimuth_deg"] == 94.748548
            assert body["observation"]["earth"]["elevation_deg"] == 5.914675

    print("PASS: Route registration and OpenAPI inspection passed.")


def main():
    test_imports()
    test_schema_validation()
    test_parser_with_sample_fixtures()
    test_malformed_handling()
    test_unsupported_configurations()
    test_timeout_and_network_failure()
    test_api_routes_and_openapi()
    print("\nALL GEOMETRY PROVIDER VERIFICATION CHECKS PASSED.")


if __name__ == "__main__":
    main()
