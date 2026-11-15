"""Prepare one native 32x32 Site04 LDEC window; Rasterio is offline tooling only."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.schemas.site04_coverage import Site04CoverageResponse

BACKEND = Path(__file__).resolve().parents[1]
SHA = "fcc8c2219ae2368d5b2a1f6aec05fcf96cf725f3035ac8d80efc312a4ff29227"
URL = "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_ldec.tif"


def main():
    import numpy as np
    import rasterio
    from rasterio.windows import Window, bounds

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    args = parser.parse_args()
    h = hashlib.sha256()
    with args.source.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    if args.source.stat().st_size != 40980740 or h.hexdigest() != SHA:
        raise ValueError("Source size/SHA mismatch; refusing ingestion")
    with rasterio.open(args.source) as ds:
        expected_transform = (-9000, 5, 0, 1000, 0, -5)
        if (ds.width, ds.height, ds.count, ds.dtypes[0]) != (3200, 3200, 1, "float32"):
            raise ValueError("Unexpected dimensions/type")
        if tuple(ds.transform.to_gdal()) != expected_transform or ds.tags().get("AREA_OR_POINT") != "Area":
            raise ValueError("Unexpected transform/registration")
        if ds.crs is None or ds.crs.to_dict().get("proj") != "stere" or ds.crs.to_dict().get("lat_0") != -90 or ds.crs.linear_units != "metre":
            raise ValueError("Unexpected projection")
        if not np.isnan(ds.nodata) or ds.scales != (1.0,) or ds.offsets != (0.0,):
            raise ValueError("Unexpected nodata/scale/offset")
        # Deterministic central native subset, not a search for favorable values.
        window = Window(1584, 1584, 32, 32)
        values = ds.read(1, window=window)
        mask = ds.read_masks(1, window=window) == 0
        cells = []
        counts = dict(observed=0, unobserved=0, nodata=0, unverified=0)
        def box(b):
            return dict(zip(("min_x", "min_y", "max_x", "max_y"), b))
        for r in range(32):
            for c in range(32):
                value = float(values[r,c])
                if mask[r,c] or np.isnan(value):
                    status, value = "nodata", None
                elif not np.isfinite(value) or value < 0 or not value.is_integer():
                    status, value = "unverified", None
                else:
                    status = "observed" if value > 0 else "unobserved"
                counts[status] += 1
                row, col = 1584+r, 1584+c
                cells.append(dict(row=row, column=col, bounds=box(bounds(Window(col,row,1,1),ds.transform)), value=value, value_unit="LOLA returns per pixel", observation_status=status))
        valid = counts["observed"] + counts["unobserved"]
        result = Site04CoverageResponse(
            status="provisional", detail="Native central 32x32 LDEC window; no interpolation. Geographic frame identification follows NASA documentation; no lat/lon conversion verified.",
            source=dict(instrument="NASA LRO / LOLA", instrument_url="https://science.nasa.gov/mission/lro/lola/", expected_product=args.source.name, product_url=URL, sha256=SHA, metadata_inspected=True, processing_version="site04-native-window-v1", validation="provisional", checks_completed=["Exact source size and supplied SHA-256 match", "Rasterio metadata, area registration, 5 m affine transform and polar stereographic CRS inspected", "Only native window rows/columns 1584..1615 read; values and masks kept distinct", "Counts checked finite, nonnegative and integral per returned valid pixel", "Cell centers round-trip through source affine mapping"]),
            coordinate_system=dict(status="verified",frame="MOON_ME / DE421 (NASA README; not encoded by name in TIFF)",crs_wkt=ds.crs.to_wkt(),projection="South polar stereographic",coordinate_units="m",axis_order=["X (easting)","Y (northing)"],reference_surface="Sphere radius 1737400 m (TIFF CRS); datum label unknown",pixel_registration="Pixel area bounds from GeoTIFF; centers at column+0.5,row+0.5, consistent with NASA GMT pixel registration",affine_transform=list(ds.transform.to_gdal()),lat_lon_transform_verified=False),
            value_unit="LOLA returns per pixel", native_resolution=dict(x_spacing=5,y_spacing=5,units="m",rows=3200,columns=3200),returned_resolution=dict(x_spacing=5,y_spacing=5,units="m",rows=32,columns=32), source_bounds=box(ds.bounds),returned_bounds=box(bounds(window,ds.transform)),nodata_value=None,nodata_status="mask-defined",
            summary=dict(status="provisional",total_pixel_count=1024,valid_pixel_count=valid,observed_pixel_count=counts["observed"],nodata_pixel_count=counts["nodata"],unverified_pixel_count=counts["unverified"],coverage_percentage=100*counts["observed"]/valid if valid else None,observation_rule="NASA defines LDEC as number of LOLA returns per pixel: positive integral count = observed; zero = unobserved; masked/NaN = nodata; other invalid values = unverified."),cells=cells,
            legend=[dict(status="observed",label="LOLA returns present",color="#5ac9ed",symbol="+"),dict(status="unobserved",label="Zero LOLA returns",color="#243849",symbol="0"),dict(status="nodata",label="Missing (mask / NaN)",color="#8899aa",symbol="-"),dict(status="unverified",label="Invalid / unverified",color="#8899aa",symbol="?")],
            limitations=["Observation counts only; not elevation, landing risk, suitability, safety or a recommendation.","Only central 160 x 160 m window; counts and percentage do not describe the entire 16 x 16 km source footprint.","TIFF datum is labelled unknown. MOON_ME/DE421 association is from official NASA product README; no independent absolute registration validation.","CRS/affine mapping verified in source X/Y metres only. No latitude/longitude conversion verified; render in source frame or withhold geographic globe overlay.","GeoTIFF nodata is NaN; schema forbids nonfinite numbers, so nodata_value is null and mask-defined status plus per-cell nodata preserve semantics.","Band unit tag is absent; returns-per-pixel interpretation comes from NASA LDEC documentation. Scale 1 and offset 0 are unchanged.","No interpolation, aggregation, gap filling or inferred values. Positive-count rule is count semantics, not a suitability threshold.","Source checksum matches the supplied local pin, not an independently published NASA checksum."])
        for cell in cells:
            x,y=ds.xy(cell["row"],cell["column"])
            if ds.index(x,y)!=(cell["row"],cell["column"]):
                raise ValueError("Coordinate roundtrip failed")
        audit=dict(source_sha256=SHA,source_bytes=40980740,rasterio_version=rasterio.__version__,gdal_version=rasterio.__gdal_version__,dtype=ds.dtypes[0],band_unit=ds.units[0],nodata="NaN",mask_flags=[[flag.name for flag in flags] for flags in ds.mask_flag_enums],tags=ds.tags(),band_tags=ds.tags(1),crs_wkt=ds.crs.to_wkt(),transform=list(ds.transform.to_gdal()),bounds=list(ds.bounds),window=dict(row_offset=1584,column_offset=1584,height=32,width=32),summary=result.summary.model_dump())
    output=BACKEND/"data/processed/site04_coverage_window.json"
    encoded=(result.model_dump_json(indent=None)+"\n").encode("utf-8")
    output.write_bytes(encoded)
    audit["artifact_sha256"]=hashlib.sha256(encoded).hexdigest()
    (BACKEND/"data/metadata/site04_coverage_inspection.json").write_text(json.dumps(audit,indent=2,allow_nan=False)+"\n",encoding="utf-8")
    print(json.dumps(dict(artifact=str(output),artifact_sha256=audit["artifact_sha256"],bytes=len(encoded),summary=result.summary.model_dump()),indent=2))


if __name__ == "__main__":
    main()
