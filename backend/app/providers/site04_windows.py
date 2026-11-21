"""Optional local GIS reader for bounded Site04 requests. No raw data in Git."""
from functools import lru_cache
import hashlib
import logging
import math
import os
from pathlib import Path

from app.providers.site04_coordinates import to_xy, to_lat_lon
from app.providers.site04_terrain import get_site04_terrain
from app.schemas.site04_terrain import Site04TerrainResponse, GeographicPoint, Site04Selection

# Independent pins, shared with the offline extractor; no self-accepted source hash.
PINS = {
    "surf": "38ff70dbdf2f066c2cfa94a646c3a59d653ce7f6b4528b15fc1b43ee397ce758",
    "slp": "ec3cfa184b114d95aff498e7452764a8569737ae829e7ff3efd38d5187182579",
    "toterr": "416c4baa3b64def0182bb3379a1a9228482efd8ce32a39309ea8de5d0330fbe6",
    "slperr": "067cd4d8e3e8c14a9a5be1915242532f85063f1b300f248407cc8c8b68e90695",
    "ldec": "fcc8c2219ae2368d5b2a1f6aec05fcf96cf725f3035ac8d80efc312a4ff29227",
}


logger = logging.getLogger(__name__)


class OutsideSite04Coverage(ValueError):
    pass


@lru_cache(maxsize=10)
def verify_source(path: str, size: int, modified: int, changed: int, expected: str):
    # Stat signature invalidates the digest cache when a file changes.
    with open(path, "rb") as stream:
        if hashlib.file_digest(stream, "sha256").hexdigest() != expected:
            raise ValueError("Site04 source checksum mismatch")


def read_window(latitude: float, longitude: float, width: int = 32) -> Site04TerrainResponse:
    base = get_site04_terrain()
    if base.status == "unavailable":
        return base
    try:
        x, y = to_xy(latitude, longitude)
    except ValueError as error:
        raise OutsideSite04Coverage(str(error)) from error
    # GDAL index convention: left/top inclusive; right/bottom exclusive.
    col, row = math.floor((x + 9000) / 5), math.floor((1000 - y) / 5)
    if not (0 <= col < 3200 and 0 <= row < 3200):
        raise OutsideSite04Coverage("Requested coordinate is outside the Site04 source raster footprint.")
    directory = os.getenv("SITE04_DATA_DIR")
    if not directory:
        return Site04TerrainResponse(status="unavailable", detail="This backend has the prepared centre patch. Other locations require the full Site04 raster set.", limitations=["The fixed central artifact remains available without GIS tooling."])
    try:
        import numpy as np
        import rasterio
        from rasterio.windows import Window, bounds
        first_row = min(max(row - width // 2, 0), 3200 - width)
        first_col = min(max(col - width // 2, 0), 3200 - width)
        window = Window(first_col, first_row, width, width)
        arrays, masks = {}, {}
        for key, checksum in PINS.items():
            path = Path(directory) / f"Site04_final_adj_5mpp_{key}.tif"
            stat = path.stat()
            verify_source(str(path.resolve()), stat.st_size, stat.st_mtime_ns, stat.st_ctime_ns, checksum)
            with rasterio.open(path) as ds:
                if (ds.width, ds.height, ds.count, ds.dtypes[0]) != (3200,3200,1,"float32") or list(ds.transform.to_gdal()) != base.coordinate_system.affine_transform or ds.crs.to_wkt() != base.coordinate_system.crs_wkt or ds.scales != (1.0,) or ds.offsets != (0.0,) or ds.tags().get("AREA_OR_POINT") != "Area" or not np.isnan(ds.nodata):
                    raise ValueError("Site04 raster metadata differs from inspected products")
                arrays[key] = ds.read(1, window=window)
                masks[key] = ds.read_masks(1, window=window) == 0
                transform = ds.transform
        def metric(key, r, c, unit):
            value = float(arrays[key][r,c])
            status = "nodata" if masks[key][r,c] or np.isnan(value) else "unverified" if not np.isfinite(value) or (key != "surf" and value < 0) else "available"
            return dict(value=value if status == "available" else None, unit=unit, status=status)
        def box(b):
            return dict(zip(("min_x","min_y","max_x","max_y"), b))
        cells = []
        for r in range(width):
            for c in range(width):
                count = float(arrays["ldec"][r,c])
                observation = "nodata" if masks["ldec"][r,c] or np.isnan(count) else "unverified" if not np.isfinite(count) or count < 0 or not count.is_integer() else "observed" if count > 0 else "unobserved"
                sr, sc = first_row+r, first_col+c
                center = to_lat_lon(*transform * (sc+0.5,sr+0.5))
                cells.append(dict(row=sr,column=sc,bounds=box(bounds(Window(sc,sr,1,1),transform)),
                    center=dict(latitude=center[0],longitude=center[1]),
                    elevation=metric("surf",r,c,"m"), slope=metric("slp",r,c,"degree"),
                    elevation_rms_uncertainty=metric("toterr",r,c,"m"), slope_rms_uncertainty=metric("slperr",r,c,"degree"), observation_status=observation))
        used = to_lat_lon(*transform * (col+0.5,row+0.5))
        payload = base.model_dump()
        payload["coordinate_system"]["lat_lon_transform_verified"] = True
        payload.update(detail="Native Site04 window selected by lunar MOON_ME/DE421 coordinates; provisional product interpretation.",
            cells=cells, returned_bounds=box(bounds(window,transform)),
            returned_resolution=dict(x_spacing=5,y_spacing=5,units="m",rows=width,columns=width),
            selection=Site04Selection(requested=GeographicPoint(latitude=latitude,longitude=longitude), nearest_cell=GeographicPoint(latitude=used[0],longitude=used[1]),row=row,column=col).model_dump(),
            mapping_status="Spherical projection checked against GDAL/PROJ; absolute frame accuracy not independently surveyed.",
            processing=f"site04-native-query-v1: source rows {first_row}..{first_row+width-1}, columns {first_col}..{first_col+width-1}; no resampling.")
        payload["limitations"] = [item for item in base.limitations if "160 x 160" not in item and "No verified lat/lon" not in item]
        payload["limitations"].append("Lunar coordinates use the product's documented MOON_ME/DE421 frame; no transformation to other lunar frames. Mathematical conversion is checked, not independent absolute geolocation accuracy. Surface Z datum and slope baseline remain unresolved.")
        return Site04TerrainResponse.model_validate(payload)
    except (ImportError, OSError, ValueError) as error:
        logger.warning("Site04 regional read failed: %s", error)
        return Site04TerrainResponse(
            status="unavailable",
            detail="The backend could not read this regional patch. Try the prepared centre patch.",
            limitations=["Regional reads require the GIS reader and all five intact Site04 rasters."],
        )
