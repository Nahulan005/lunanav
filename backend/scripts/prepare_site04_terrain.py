"""Offline native window extraction; raw TIFFs remain outside the repository."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from app.schemas.site04_terrain import Site04TerrainResponse

PINS = {
    "surf": "38ff70dbdf2f066c2cfa94a646c3a59d653ce7f6b4528b15fc1b43ee397ce758",
    "slp": "ec3cfa184b114d95aff498e7452764a8569737ae829e7ff3efd38d5187182579",
    "toterr": "416c4baa3b64def0182bb3379a1a9228482efd8ce32a39309ea8de5d0330fbe6",
    "slperr": "067cd4d8e3e8c14a9a5be1915242532f85063f1b300f248407cc8c8b68e90695",
    "ldec": "fcc8c2219ae2368d5b2a1f6aec05fcf96cf725f3035ac8d80efc312a4ff29227",
}


def main():
    import numpy as np
    import rasterio
    from rasterio.windows import Window, bounds
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    arrays, masks, sources, audit = {}, {}, [], {}
    coverage = json.loads((BACKEND / "data/processed/site04_coverage_window.json").read_bytes())
    window = Window(1584, 1584, 32, 32)
    for key, pin in PINS.items():
        path = args.directory / f"Site04_final_adj_5mpp_{key}.tif"
        with path.open("rb") as stream:
            checksum = hashlib.file_digest(stream, "sha256").hexdigest()
        if checksum != pin:
            raise ValueError(f"Source checksum mismatch: {path.name}")
        with rasterio.open(path) as ds:
            if (ds.width, ds.height, ds.count, ds.dtypes[0]) != (3200, 3200, 1, "float32"):
                raise ValueError("Unexpected grid dimensions/type")
            if list(ds.transform.to_gdal()) != coverage["coordinate_system"]["affine_transform"] or ds.crs.to_wkt() != coverage["coordinate_system"]["crs_wkt"]:
                raise ValueError("Source alignment differs from inspected coverage grid")
            if ds.tags().get("AREA_OR_POINT") != "Area" or not np.isnan(ds.nodata) or ds.scales != (1.0,) or ds.offsets != (0.0,):
                raise ValueError("Unexpected registration/nodata/scaling")
            arrays[key] = ds.read(1, window=window)
            masks[key] = ds.read_masks(1, window=window) == 0
            transform = ds.transform
            for row in range(1584, 1616):
                for col in range(1584, 1616):
                    if ds.index(*ds.xy(row, col)) != (row, col):
                        raise ValueError("Native coordinate roundtrip failed")
            audit[key] = dict(tags=ds.tags(), band_tags=ds.tags(1), band_unit=ds.units[0],
                crs_wkt=ds.crs.to_wkt(), transform=list(ds.transform.to_gdal()), bounds=list(ds.bounds),
                dtype=ds.dtypes[0], nodata="NaN", scales=list(ds.scales), offsets=list(ds.offsets),
                mask_flags=[[flag.name for flag in flags] for flags in ds.mask_flag_enums])
        sources.append(dict(product=path.name, url=f"https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/{path.name}", sha256=checksum, bytes=path.stat().st_size))
    def value(key, r, c, unit):
        number = float(arrays[key][r, c])
        status = "available"
        if masks[key][r, c] or np.isnan(number):
            status = "nodata"
        elif not np.isfinite(number) or (key != "surf" and number < 0):
            status = "unverified"
        return dict(value=number if status == "available" else None, unit=unit, status=status)
    cells = []
    for r in range(32):
        for c in range(32):
            count = float(arrays["ldec"][r, c])
            observation = "nodata" if masks["ldec"][r,c] or np.isnan(count) else "unverified" if not np.isfinite(count) or count < 0 or not count.is_integer() else "observed" if count > 0 else "unobserved"
            cells.append(dict(row=1584+r, column=1584+c,
                bounds=dict(zip(("min_x", "min_y", "max_x", "max_y"), bounds(Window(1584+c,1584+r,1,1),transform))),
                elevation=value("surf",r,c,"m"), slope=value("slp",r,c,"degree"),
                elevation_rms_uncertainty=value("toterr",r,c,"m"), slope_rms_uncertainty=value("slperr",r,c,"degree"), observation_status=observation))
    result = Site04TerrainResponse(status="provisional", detail="Real native LOLA product values; absolute geographic registration remains unverified.",
        sources=sources, coordinate_system=coverage["coordinate_system"], native_resolution=coverage["native_resolution"],
        returned_resolution=coverage["returned_resolution"], returned_bounds=coverage["returned_bounds"],
        elevation_reference="NASA README: surface height Z in metres; absolute vertical reference not confirmed from supplied TIFF/README. CRS sphere radius 1737400 m is not asserted as the elevation datum.",
        processing="site04-terrain-window-v1: rows/columns 1584..1615; native cells, masks and scale preserved; no interpolation or slope calculation by LunaNav.",
        cells=cells, limitations=[
            "Only 160 x 160 m subset of Site04; no values outside the returned bounds.",
            "SURF is NASA's interpolated surface model; zero LDEC returns do not invalidate the surface value but indicate no direct returns in that pixel.",
            "Units and RMS uncertainty meanings follow NASA product documentation; TIFF band-unit tags are absent.",
            "MOON_ME/DE421 association follows NASA README; TIFF datum is unknown. No verified lat/lon transformation or globe overlay.",
            "Vertical reference and slope spatial baseline require further confirmation; 5 m pixel spacing does not establish lander-footprint slope accuracy.",
            "Supplied local source hashes are integrity pins, not independently NASA-published checksums.",
            "No terrain horizon, illumination duration, RF assessment, mission thresholds, suitability score or recommendation is computed."])
    encoded = (result.model_dump_json()+"\n").encode()
    (BACKEND/"data/processed/site04_terrain_window.json").write_bytes(encoded)
    audit.update(sources=sources, artifact_sha256=hashlib.sha256(encoded).hexdigest(), rasterio_version=rasterio.__version__, gdal_version=rasterio.__gdal_version__)
    (BACKEND/"data/metadata/site04_terrain_inspection.json").write_bytes((json.dumps(audit,indent=2)+"\n").encode())
    print(json.dumps(dict(artifact_sha256=audit["artifact_sha256"], bytes=len(encoded), cells=len(cells), first_cell=cells[0]),indent=2))


if __name__ == "__main__":
    main()
