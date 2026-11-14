"""Strict, standard-library-only ingestion of one documented PDS LOLA product.

No general GIS reader: supports only LDEM_4 V3.0 SignedLSB2, pixel-registered 4 pix/deg.
"""
from array import array
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
from urllib.request import urlopen
import xml.etree.ElementTree as ET

BACKEND = Path(__file__).resolve().parents[1]
BASE_URL = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/"
NS = {"p": "http://pds.nasa.gov/pds4/pds/v1", "c": "http://pds.nasa.gov/pds4/cart/v1", "l": "http://pds.nasa.gov/pds4/mission/lro/v1"}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def download(name: str, limit: int) -> bytes:
    with urlopen(BASE_URL + name, timeout=45) as response:
        if int(response.headers.get("Content-Length", 0)) > limit:
            raise RuntimeError(f"Refusing oversized download: {name}")
        data = response.read(limit + 1)
    if len(data) > limit:
        raise RuntimeError(f"Download exceeds size cap: {name}")
    return data


def main() -> None:
    raw_dir = BACKEND / "data/raw"
    metadata_dir = BACKEND / "data/metadata"
    raw_dir.mkdir(parents=True, exist_ok=True)
    metadata_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = metadata_dir / "lola_sample_manifest.json"
    old = json.loads(manifest_path.read_text()) if manifest_path.exists() else None
    files, artifacts = {}, {}
    for name, limit in (("ldem_4.lbl", 20000), ("ldem_4.xml", 25000), ("ldem_4.img", 2073600)):
        data = download(name, limit)
        files[name] = data
        artifacts[name] = {"url": BASE_URL + name, "sha256": sha256(data), "bytes": len(data)}
        if old and old["source_artifacts"][name]["sha256"] != sha256(data):
            raise RuntimeError(f"Source changed: {name}; review before replacing pinned provenance")

    root = ET.fromstring(files["ldem_4.xml"])
    def text(path: str) -> str:
        value = root.findtext(path, namespaces=NS)
        if value is None:
            raise RuntimeError(f"Missing required label field: {path}")
        return value.strip()

    expected = {
        ".//p:Element_Array/p:data_type": "SignedLSB2",
        ".//p:Element_Array/p:unit": "METER",
        ".//p:Element_Array/p:scaling_factor": "0.5",
        ".//p:Element_Array/p:value_offset": "1737400.",
        ".//p:Array_2D_Image/p:offset": "0",
        ".//p:Array_2D_Image/p:axis_index_order": "Last Index Fastest",
        ".//l:product_version_id": "V3.0",
        ".//c:latitude_type": "Planetocentric",
        ".//c:longitude_direction": "Positive East",
        ".//c:coordinate_system_name": "MEAN EARTH/POLAR AXIS OF DE421",
        ".//c:map_projection_name": "Equirectangular",
        ".//c:longitude_of_central_meridian": "180",
        ".//c:standard_parallel_1": "0",
        ".//c:a_axis_radius": "1737.4",
        ".//c:b_axis_radius": "1737.4",
        ".//c:c_axis_radius": "1737.4",
        ".//c:pixel_scale_x": "4",
        ".//c:pixel_scale_y": "4",
        ".//c:west_bounding_coordinate": "0",
        ".//c:east_bounding_coordinate": "360",
        ".//c:north_bounding_coordinate": "90",
        ".//c:south_bounding_coordinate": "-90",
    }
    for path, value in expected.items():
        if text(path) != value:
            raise RuntimeError(f"Unexpected label field {path}: {text(path)}")
    axes = {axis.findtext("p:axis_name", namespaces=NS): int(axis.findtext("p:elements", namespaces=NS))
            for axis in root.findall(".//p:Array_2D_Image/p:Axis_Array", NS)}
    if axes != {"Line": 720, "Sample": 1440}:
        raise RuntimeError("Unexpected grid dimensions")
    if root.find(".//p:Special_Constants", NS) is not None:
        raise RuntimeError("Product defines special constants; review nodata handling")
    label = files["ldem_4.lbl"].decode("ascii")
    if "HEIGHT = (DN * SCALING_FACTOR)" not in label or "pixel registered" not in label:
        raise RuntimeError("Explicit height conversion or registration note missing")
    if len(files["ldem_4.img"]) != 720 * 1440 * 2:
        raise RuntimeError("Wrong source raster byte count")

    # Two independent byte-decoding paths check signedness and byte order.
    pixels = array("h")
    if pixels.itemsize != 2:
        raise RuntimeError("Platform does not have 16-bit short integers")
    pixels.frombytes(files["ldem_4.img"])
    if sys.byteorder != "little":
        pixels.byteswap()
    if any(value != decoded[0] for value, decoded in zip(pixels, struct.iter_unpack("<h", files["ldem_4.img"]))):
        raise RuntimeError("Independent raw decoders disagree")
    minimum = int(text(".//p:Object_Statistics/p:minimum"))
    maximum = int(text(".//p:Object_Statistics/p:maximum"))
    observed_minimum, observed_maximum = min(pixels), max(pixels)
    if observed_minimum < minimum or observed_maximum > maximum:
        raise RuntimeError("Source contains values outside the label's valid range; stop ingestion")

    # Retain only native source rows [248,312), columns [96,160), without resampling.
    row_offset, col_offset, size = 248, 96, 64
    cutout = b"".join(files["ldem_4.img"][(row * 1440 + col_offset) * 2:(row * 1440 + col_offset + size) * 2]
                       for row in range(row_offset, row_offset + size))
    lat, lon = 20.19, 30.77
    row, col = math.floor((90 - lat) * 4), math.floor((lon % 360) * 4)
    used_lat, used_lon = 90 - (row + 0.5) / 4, (col + 0.5) / 4
    roundtrip = [math.floor((90 - used_lat) * 4), math.floor(used_lon * 4)]
    if roundtrip != [row, col]:
        raise RuntimeError("Coordinate round trip changes pixel")
    raw_dn = struct.unpack_from("<h", files["ldem_4.img"], (row * 1440 + col) * 2)[0]
    if raw_dn != struct.unpack_from("<h", cutout, ((row - row_offset) * size + col - col_offset) * 2)[0]:
        raise RuntimeError("Source and retained cutout disagree")

    manifest = {
        "schema_version": 1, "prepared_utc": datetime.now(timezone.utc).isoformat(),
        "source_name": "NASA LRO / Lunar Orbiter Laser Altimeter (LOLA), NASA PDS Geosciences Node",
        "official_instrument_url": "https://science.nasa.gov/mission/lro/lola/",
        "source_url": BASE_URL + "ldem_4.img", "product_name": "LDEM_4", "product_version": "V3.0",
        "logical_identifier": text("p:Identification_Area/p:logical_identifier"),
        "source_artifacts": artifacts, "source_dimensions": {"width": 1440, "height": 720},
        "source_dtype": "little-endian signed 16-bit integer", "source_dn_min": minimum, "source_dn_max": maximum,
        "observed_source_dn_min": observed_minimum, "observed_source_dn_max": observed_maximum,
        "label_statistics_note": "Observed minimum is -17757 DN, one DN above label minimum -17758; maximum agrees at 21008. All samples are within the declared range. Cause not established; this discrepancy is retained, not corrected.",
        "units": "m", "scale_factor": 0.5, "elevation_offset_m": 0.0, "reference_radius_m": 1737400.0,
        "elevation_formula": "elevation_m = raw_dn * 0.5; do not add planetary radius offset",
        "nodata_value": None,
        "nodata_policy": "Neither label declares a sentinel. All source values lie within the label's stated extrema. No missing-data guarantee beyond these checks.",
        "crs": {"projection": "Equirectangular / Simple Cylindrical", "central_meridian_deg": 180,
            "standard_parallel_deg": 0, "sphere_radius_m": 1737400,
            "lunar_frame": text(".//c:coordinate_system_name"), "epsg": None},
        "latitude_convention": "planetocentric", "longitude_convention": "positive-east; source 0..360 degrees",
        "pixel_registration": "pixel center", "pixel_scale_per_degree": 4,
        "label_projected_pixel_spacing_m": 7580.84,
        "coordinate_method": "Use label angular grid at exactly 4 pixels/degree; no terrestrial CRS or frame transformation. Rounded projected spacing is metadata, not the lookup basis.",
        "crop": {"source_row_offset": row_offset, "source_col_offset": col_offset, "width": size, "height": size,
            "bounds_deg": {"west": 24, "east": 40, "south": 12, "north": 28},
            "boundary_policy": "west/north included; east/south excluded"},
        "local_raster": "data/raw/ldem_4_apollo17_cutout.bin", "local_sha256": sha256(cutout), "local_bytes": len(cutout),
        "validation": {"status": "ingestion-verified-not-scientifically-validated",
            "checks": ["official PDS3/PDS4 labels", "exact byte count", "array and struct decoding agree for all source DNs", "all DNs within label range; minimum discrepancy documented", "unresampled cutout", "demo source byte comparison", "pixel-center coordinate round trip"],
            "demo": {"requested": {"latitude": lat, "longitude": lon}, "used": {"latitude": used_lat, "longitude": used_lon},
                "source_row": row, "source_col": col, "raw_dn": raw_dn, "elevation_m": raw_dn * 0.5,
                "roundtrip_source_pixel": roundtrip, "pixel_center_roundtrip_error_deg": [0.0, 0.0]}},
        "software": {"python": sys.version.split()[0], "reader": "LunaNav strict LDEM_4 SignedLSB2 reader v1; standard library"},
        "limitations": ["Coarse 0.25 degree grid; pixel spacing is not elevation accuracy.",
            "Label minimum differs from file minimum by one DN (0.5 m); the cause is not established. No sample values were adjusted.",
            "One containing-cell sample; no interpolation or site-scale terrain analysis.",
            "Input coordinates must already be planetocentric in the label's DE421 mean Earth/polar-axis frame.",
            "Product warns of possible artifacts at 45-degree latitude band edges.",
            "No slope, horizon, SPICE, radio link, or landing-safety assessment.",
            "SHA-256 is computed locally from HTTPS downloads, not an independently published NASA checksum."],
    }
    # Full IMG exists only in memory; persist the bounded subset and original labels.
    for name in ("ldem_4.lbl", "ldem_4.xml"):
        (metadata_dir / name).write_bytes(files[name])
    (raw_dir / "ldem_4_apollo17_cutout.bin").write_bytes(cutout)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"retained_bytes": len(cutout), "validation": manifest["validation"]}, indent=2))


if __name__ == "__main__":
    main()
