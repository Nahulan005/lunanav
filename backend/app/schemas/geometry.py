from datetime import date, datetime
from typing import Literal
from pydantic import Field
from app.schemas.analysis import Contract


class TargetDirection(Contract):
    azimuth_deg: float = Field(
        ge=0, lt=360,
        description="Airless apparent azimuth measured clockwise from North: North=0, East=90, South=180, West=270 deg."
    )
    elevation_deg: float = Field(
        ge=-90, le=90,
        description="Airless apparent topocentric elevation angle relative to the local horizontal tangent plane on the reference sphere."
    )
    right_ascension: str | None = Field(
        default=None,
        description="Astrometric right ascension in the ICRF (HH MM SS.ss)."
    )
    declination: str | None = Field(
        default=None,
        description="Astrometric declination in the ICRF (sDD MM SS.s)."
    )


class SunEarthObservation(Contract):
    timestamp_utc: datetime = Field(description="Observation epoch in UTC.")
    sun: TargetDirection = Field(description="Sun position as viewed from the topocentric lunar observer site.")
    earth: TargetDirection = Field(description="Earth center position as viewed from the topocentric lunar observer site.")
    reference_frame: str = Field(
        default="MEAN_ME (high precision) / DE441",
        description="Body-fixed lunar reference frame used for coordinates and orientation."
    )
    reference_ellipsoid: str = Field(
        default="Sphere radius 1737.4 km",
        description="Reference surface parameters: radius 1737.4 km (no topography or DEM)."
    )
    solar_presence: str | None = Field(
        default=None,
        description="Horizons observing site flag: '*' indicates daylight (solar upper-limb on/above horizon), None indicates night."
    )
    interfering_body: str | None = Field(
        default=None,
        description="Horizons interfering body presence: 'i' indicates Earth is on/above horizon."
    )


class HorizonsPreparedRequest(Contract):
    api_url: str = Field(
        default="https://ssd.jpl.nasa.gov/api/horizons.api",
        description="JPL Horizons REST API endpoint URL."
    )
    http_method: Literal["GET"] = "GET"
    sun_parameters: dict[str, str] = Field(
        description="Documented Horizons parameters for Sun (target 10) observer query."
    )
    earth_parameters: dict[str, str] = Field(
        description="Documented Horizons parameters for Earth (target 399) observer query."
    )


class SunEarthGeometryResponse(Contract):
    status: Literal["available", "unavailable", "unsupported"] = Field(
        description="Execution status: 'available' if live data was retrieved and validated, 'unavailable' if the service is unreachable or failed, 'unsupported' if parameters are invalid."
    )
    provider_name: Literal["JPL Horizons On-Line Ephemeris System (API v1.3)"] = "JPL Horizons On-Line Ephemeris System (API v1.3)"
    requested_site_id: str = Field(description="Requested landing site identifier.")
    requested_latitude: float = Field(description="Requested geodetic latitude in degrees.")
    requested_longitude: float = Field(description="Requested east longitude in degrees.")
    requested_date: date = Field(description="Requested mission date (UTC).")
    request_parameters: HorizonsPreparedRequest = Field(
        description="Prepared JPL Horizons request parameters according to official documentation."
    )
    live_request_executed: bool = Field(
        description="True if an HTTP network request to the JPL Horizons service was dispatched."
    )
    provenance_url: str = Field(
        default="https://ssd.jpl.nasa.gov/api/horizons.api",
        description="API provenance endpoint URL."
    )
    documentation_url: str = Field(
        default="https://ssd-api.jpl.nasa.gov/doc/horizons.html",
        description="Official JPL Horizons documentation URL."
    )
    limitation_explanation: list[str] = Field(
        description="Scientific caveats, assumptions, and limitations of the calculated geometry."
    )
    observation: SunEarthObservation | None = Field(
        default=None,
        description="Parsed and validated observation data. None if status is unavailable or unsupported."
    )
    observations: list[SunEarthObservation] = Field(
       default_factory=list,
       description="Time-ordered Sun and Earth observations throughout the requested UTC day."
    )
    detail: str | None = Field(
        default=None,
        description="Diagnostic or error explanation when status is unavailable or unsupported."
    )
