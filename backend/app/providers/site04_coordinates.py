"""Spherical south-polar stereographic mapping for the inspected Site04 CRS.

MOON_ME/DE421 geographic coordinates, east-positive degrees; metres in X/Y.
Checked independently against GDAL/PROJ, not a claim of geodetic accuracy.
"""
import math

RADIUS_M = 1737400.0


def to_xy(latitude: float, longitude: float) -> tuple[float, float]:
    if not math.isfinite(latitude) or not math.isfinite(longitude) or not -90 <= latitude < 0 or not -180 <= longitude <= 180:
        raise ValueError("Site04 mapping requires southern latitude and east longitude in [-180,180].")
    rho = 2 * RADIUS_M * math.tan(math.radians(90 + latitude) / 2)
    lon = math.radians(longitude)
    return rho * math.sin(lon), rho * math.cos(lon)


def to_lat_lon(x: float, y: float) -> tuple[float, float]:
    if not math.isfinite(x) or not math.isfinite(y):
        raise ValueError("Nonfinite projected coordinate")
    return -90 + math.degrees(2 * math.atan2(math.hypot(x, y), 2 * RADIUS_M)), math.degrees(math.atan2(x, y))
