"""JPL Horizons Sun and Earth geometry provider for topocentric lunar observers.

Calculates time-dependent apparent topocentric Sun and Earth vectors (azimuth and elevation)
from documented NASA/JPL Horizons API parameters (CENTER='coord@301').

Does NOT fabricate mock values or substitute Moon-center vectors when live queries fail.
"""
from pydantic import ValidationError
from datetime import date, datetime, timedelta, timezone
import json
import math
import os
import re
import socket
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from app.schemas.geometry import (
    HorizonsPreparedRequest,
    SunEarthGeometryResponse,
    SunEarthObservation,
    TargetDirection,
)

HORIZONS_API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"
HORIZONS_DOC_URL = "https://ssd-api.jpl.nasa.gov/doc/horizons.html"
DEFAULT_TIMEOUT_SECONDS = 8.0

SCIENTIFIC_LIMITATIONS = [
    "Topocentric calculations use an idealized spherical lunar reference surface (radius 1737.4 km, MEAN_ME frame); local topography, elevation differences from LOLA DEM, and crater rim masking are not modeled.",
    "Elevation angles are measured from the local reference plane tangent to the smooth sphere. Positive elevation does not guarantee line-of-sight visibility if terrain obstructions (crater rims, ridges) exist.",
    "Earth elevation indicates geometric line-of-sight above the smooth horizon only; it does not model antenna gain, RF link margin, or radio communication feasibility.",
    "Sun position represents the point-source center of the solar disk (angular diameter ~0.53 deg); partial occultation at grazing angles is not modeled.",
    "Airless apparent coordinates include light-time, stellar aberration, and precession/nutation; no atmospheric refraction is applied (consistent with the lunar vacuum).",
]


class HorizonsError(Exception):
    """Base error for JPL Horizons provider."""


class HorizonsApiError(HorizonsError):
    """Raised when Horizons returns an error response."""


class HorizonsParsingError(HorizonsError):
    """Raised when Horizons output cannot be parsed into validated geometry."""


class JplHorizonsGeometryProvider:
    """Typed provider adapter for NASA JPL Horizons Sun and Earth ephemeris."""

    def __init__(
        self,
        api_url: str = HORIZONS_API_URL,
        timeout_seconds: float | None = None,
        enable_network: bool = True,
    ):
        self.api_url = api_url
        env_timeout = os.getenv("HORIZONS_TIMEOUT_SECONDS")
        if timeout_seconds is not None:
            self.timeout_seconds = timeout_seconds
        elif env_timeout:
            try:
                self.timeout_seconds = float(env_timeout)
            except ValueError:
                self.timeout_seconds = DEFAULT_TIMEOUT_SECONDS
        else:
            self.timeout_seconds = DEFAULT_TIMEOUT_SECONDS
        self.enable_network = enable_network

    def prepare_request(
        self,
        latitude: float,
        longitude: float,
        target_date: date,
        observer_height_m: float = 2.0,
    ) -> HorizonsPreparedRequest:
        """Construct documented Horizons request parameters for Sun and Earth queries."""
        next_date = target_date + timedelta(days=1)
        height_km = observer_height_m / 1000.0
        site_coord = f"{longitude:.6f},{latitude:.6f},{height_km:.6f}"
        start_str = target_date.strftime("%Y-%m-%d")
        stop_str = next_date.strftime("%Y-%m-%d")

        common_params = {
            "format": "json",
            "EPHEM_TYPE": "'OBSERVER'",
            "CENTER": "'coord@301'",
            "SITE_COORD": f"'{site_coord}'",
            "COORD_TYPE": "'GEODETIC'",
            "START_TIME": f"'{start_str}'",
            "STOP_TIME": f"'{stop_str}'",
            "STEP_SIZE": "'10m'",
            "QUANTITIES": "'1,4'",
        }

        sun_params = {**common_params, "COMMAND": "'10'"}
        earth_params = {**common_params, "COMMAND": "'399'"}

        api_key = os.getenv("HORIZONS_API_KEY")
        if api_key:
            sun_params["api_key"] = api_key
            earth_params["api_key"] = api_key

        return HorizonsPreparedRequest(
            api_url=self.api_url,
            http_method="GET",
            sun_parameters=sun_params,
            earth_parameters=earth_params,
        )

    def get_sun_earth_geometry(
        self,
        site_id: str,
        latitude: float,
        longitude: float,
        target_date: date,
        observer_height_m: float = 2.0,
    ) -> SunEarthGeometryResponse:
        """Execute or prepare JPL Horizons observation queries for Sun and Earth."""
        prepared = self.prepare_request(
            latitude=latitude,
            longitude=longitude,
            target_date=target_date,
            observer_height_m=observer_height_m,
        )

        # Phase 3 validation: Verify coordinates and dates are physically supported.
        if not (
            math.isfinite(latitude)
            and math.isfinite(longitude)
            and math.isfinite(observer_height_m)
        ):
            return SunEarthGeometryResponse(
                status="unsupported",
                requested_site_id=site_id,
                requested_latitude=latitude,
                requested_longitude=longitude,
                requested_date=target_date,
                request_parameters=prepared,
                live_request_executed=False,
                limitation_explanation=SCIENTIFIC_LIMITATIONS,
                observation=None,
                detail="Coordinates or observer height must be finite numbers.",
            )

        if not (-90.0 <= latitude <= 90.0 and -180.0 <= longitude <= 180.0):
            return SunEarthGeometryResponse(
                status="unsupported",
                requested_site_id=site_id,
                requested_latitude=latitude,
                requested_longitude=longitude,
                requested_date=target_date,
                request_parameters=prepared,
                live_request_executed=False,
                limitation_explanation=SCIENTIFIC_LIMITATIONS,
                observation=None,
                detail=f"Latitude ({latitude}) must be in [-90, 90] and longitude ({longitude}) in [-180, 180] degrees.",
            )

        if not (1800 <= target_date.year <= 2200):
            return SunEarthGeometryResponse(
                status="unsupported",
                requested_site_id=site_id,
                requested_latitude=latitude,
                requested_longitude=longitude,
                requested_date=target_date,
                request_parameters=prepared,
                live_request_executed=False,
                limitation_explanation=SCIENTIFIC_LIMITATIONS,
                observation=None,
                detail=f"Requested year ({target_date.year}) is outside LunaNav's currently configured supported date range [1800, 2200].",
            )

        if not self.enable_network:
            return SunEarthGeometryResponse(
                status="unavailable",
                requested_site_id=site_id,
                requested_latitude=latitude,
                requested_longitude=longitude,
                requested_date=target_date,
                request_parameters=prepared,
                live_request_executed=False,
                limitation_explanation=SCIENTIFIC_LIMITATIONS,
                observation=None,
                detail="Live network access is disabled for this provider instance; prepared parameters are available.",
            )

        # Execute live queries for Sun and Earth
        try:
            sun_data = self._execute_query(prepared.sun_parameters)
            earth_data = self._execute_query(prepared.earth_parameters)
        except (
            urllib.error.URLError,
            urllib.error.HTTPError,
            socket.timeout,
            TimeoutError,
            ConnectionError,
            OSError,
        ) as net_err:
            return SunEarthGeometryResponse(
                status="unavailable",
                requested_site_id=site_id,
                requested_latitude=latitude,
                requested_longitude=longitude,
                requested_date=target_date,
                request_parameters=prepared,
                live_request_executed=True,
                limitation_explanation=SCIENTIFIC_LIMITATIONS,
                observation=None,
                detail=f"JPL Horizons network query failed or timed out: {net_err}",
            )
        except HorizonsApiError as api_err:
            return SunEarthGeometryResponse(
                status="unavailable",
                requested_site_id=site_id,
                requested_latitude=latitude,
                requested_longitude=longitude,
                requested_date=target_date,
                request_parameters=prepared,
                live_request_executed=True,
                limitation_explanation=SCIENTIFIC_LIMITATIONS,
                observation=None,
                detail=f"JPL Horizons returned service error: {api_err}",
            )
        except json.JSONDecodeError as json_err:
            return SunEarthGeometryResponse(
                status="unavailable",
                requested_site_id=site_id,
                requested_latitude=latitude,
                requested_longitude=longitude,
                requested_date=target_date,
                request_parameters=prepared,
                live_request_executed=True,
                limitation_explanation=SCIENTIFIC_LIMITATIONS,
                observation=None,
                detail=f"Horizons returned malformed JSON: {json_err}",
            )
        except HorizonsParsingError as parse_err:
            return SunEarthGeometryResponse(
                status="unavailable",
                requested_site_id=site_id,
                requested_latitude=latitude,
                requested_longitude=longitude,
                requested_date=target_date,
                request_parameters=prepared,
                live_request_executed=True,
                limitation_explanation=SCIENTIFIC_LIMITATIONS,
                observation=None,
                detail=f"Malformed or unexpected Horizons output: {parse_err}",
            )


        # Parse and validate the response
        try:
            sun_records = self._parse_horizons_text(
                sun_data.get("result", ""), expected_target="Sun (10)"
            )
            earth_records = self._parse_horizons_text(
                earth_data.get("result", ""), expected_target="Earth (399)"
            )

            if not sun_records or not earth_records:
                raise HorizonsParsingError(
                    "Horizons returned no Sun or Earth observations."
                )

            sun_timestamps = [record[1] for record in sun_records]
            earth_timestamps = [record[1] for record in earth_records]

            if sun_timestamps != earth_timestamps:
                raise HorizonsParsingError(
                    "Sun and Earth observation timestamps do not match."
                )

        except HorizonsParsingError as parse_err:
            return SunEarthGeometryResponse(
                status="unavailable",
                requested_site_id=site_id,
                requested_latitude=latitude,
                requested_longitude=longitude,
                requested_date=target_date,
                request_parameters=prepared,
                live_request_executed=True,
                limitation_explanation=SCIENTIFIC_LIMITATIONS,
                observation=None,
                observations=[],
                detail=f"Malformed or unexpected Horizons output: {parse_err}",
            )

        # Build paired Sun/Earth observations for every timestamp
        try:
            observations = []

            for sun_record, earth_record in zip(sun_records, earth_records):
                sun_direction, timestamp, solar_presence, interfering = sun_record
                earth_direction, earth_timestamp, _, _ = earth_record

                if timestamp != earth_timestamp:
                    raise HorizonsParsingError(
                        "Sun and Earth timestamps differ while pairing observations."
                    )

                observation = SunEarthObservation(
                    timestamp_utc=timestamp,
                    sun=sun_direction,
                    earth=earth_direction,
                    reference_frame="MEAN_ME (high precision)",
                    reference_ellipsoid="Sphere radius 1737.4 km",
                    solar_presence=solar_presence,
                    interfering_body=interfering,
                )

                observations.append(observation)

        except (ValidationError, HorizonsParsingError) as err:
            return SunEarthGeometryResponse(
                status="unavailable",
                requested_site_id=site_id,
                requested_latitude=latitude,
                requested_longitude=longitude,
                requested_date=target_date,
                request_parameters=prepared,
                live_request_executed=True,
                provenance_url=HORIZONS_API_URL,
                documentation_url=HORIZONS_DOC_URL,
                limitation_explanation=SCIENTIFIC_LIMITATIONS,
                observation=None,
                observations=[],
                detail=f"Horizons observations failed validation: {err}",
            )

        # Keep the first observation for backward compatibility
        return SunEarthGeometryResponse(
            status="available",
            requested_site_id=site_id,
            requested_latitude=latitude,
            requested_longitude=longitude,
            requested_date=target_date,
            request_parameters=prepared,
            live_request_executed=True,
            limitation_explanation=SCIENTIFIC_LIMITATIONS,
            observation=observations[0],
            observations=observations,
            detail=None,
        )


    def _execute_query(self, params: dict[str, str]) -> dict[str, Any]:
        """Perform a single bounded HTTP GET request to Horizons API."""
        query_string = urllib.parse.urlencode(params)
        full_url = f"{self.api_url}?{query_string}"
        request = urllib.request.Request(
            full_url,
            headers={
                "User-Agent": "LunaNav/0.1.0 (NASA LRO/Horizons geometry adapter; fail-closed)",
                "Accept": "application/json",
            },
        )

        with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
            raw_bytes = response.read(262144)  # 256KB cap to prevent unbounded payloads
            if len(raw_bytes) >= 262144:
                raise HorizonsParsingError("Horizons payload exceeded 256KB safety limit.")
            data = json.loads(raw_bytes.decode("utf-8", errors="replace"))

        if not isinstance(data, dict):
            raise HorizonsParsingError("Horizons API returned non-dictionary JSON.")

        if "error" in data and data["error"]:
            raise HorizonsApiError(str(data["error"]))

        return data


    def _parse_horizons_text(
        self, text: str, expected_target: str
    ) -> list[tuple[TargetDirection, datetime, str | None, str | None]]:
        """Parse every ephemeris record between $$SOE and $$EOE."""
        if not text:
            raise HorizonsParsingError("Empty text payload from Horizons.")

        if "$$SOE" not in text or "$$EOE" not in text:
            for line in text.splitlines():
                if "error" in line.lower() or "exception" in line.lower():
                    raise HorizonsParsingError(line.strip())
            raise HorizonsParsingError("Missing $$SOE / $$EOE ephemeris delimiters.")

        if expected_target not in text:
            raise HorizonsParsingError(
                f"Expected target '{expected_target}' not found in header."
            )

        if "Moon (301)" not in text:
            raise HorizonsParsingError(
                "Expected center 'Moon (301)' not found in header."
            )

        soe_index = text.index("$$SOE") + len("$$SOE")
        eoe_index = text.index("$$EOE")
        block = text[soe_index:eoe_index].strip()
        lines = [line.strip() for line in block.splitlines() if line.strip()]

        if not lines:
            raise HorizonsParsingError(
                "No observation records between $$SOE and $$EOE."
            )

        observations = []
        previous_timestamp = None

        for line in lines:
            parts = line.split()

            if len(parts) < 10:
                raise HorizonsParsingError(
                    f"Ephemeris row has fewer than 10 tokens: '{line}'"
                )

            date_str, time_str = parts[0], parts[1]

            try:
                timestamp = datetime.strptime(
                    f"{date_str} {time_str}", "%Y-%b-%d %H:%M"
                ).replace(tzinfo=timezone.utc)
            except ValueError as err:
                raise HorizonsParsingError(
                    f"Failed to parse timestamp '{date_str} {time_str}': {err}"
                ) from err

            if previous_timestamp is not None and timestamp <= previous_timestamp:
                raise HorizonsParsingError(
                    "Ephemeris timestamps must be strictly increasing."
                )

            numeric_parts = parts[-8:]
            flags_part = parts[2:-8]
            flags = "".join(flags_part)

            solar_presence = "*" if "*" in flags else None
            interfering = "i" if "i" in flags else None

            ra_str = f"{numeric_parts[0]} {numeric_parts[1]} {numeric_parts[2]}"
            dec_str = f"{numeric_parts[3]} {numeric_parts[4]} {numeric_parts[5]}"

            try:
                azimuth = float(numeric_parts[6])
                elevation = float(numeric_parts[7])
            except ValueError as err:
                raise HorizonsParsingError(
                    f"Failed to parse numeric angles: {err}"
                ) from err

            if not (0.0 <= azimuth < 360.0):
                azimuth %= 360.0

            if not (-90.0 <= elevation <= 90.0):
                raise HorizonsParsingError(
                    f"Parsed elevation {elevation} out of range [-90, 90]."
                )

            direction = TargetDirection(
                azimuth_deg=round(azimuth, 6),
                elevation_deg=round(elevation, 6),
                right_ascension=ra_str,
                declination=dec_str,
            )

            observations.append(
                (direction, timestamp, solar_presence, interfering)
            )
            previous_timestamp = timestamp

        return observations
