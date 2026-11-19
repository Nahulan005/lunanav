# Site04 native terrain API

`GET /api/v1/terrain/site04/grid` has no query parameters. It returns the
fixed central 32 x 32 native window, or `status: unavailable` with empty cells
on artifact integrity failure. The full typed contract is
`app/schemas/site04_terrain.py` and the application's OpenAPI document.
The existing observation-coverage endpoint and contracts remain unchanged.

## Inspected inputs

Official source: https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/
Files are under the official `Site04/` directory. NASA's supplied README defines:

| Suffix | Meaning | Unit |
| --- | --- | --- |
| surf | Interpolated surface height Z | m |
| slp | Slope product | degrees |
| toterr | Total Z uncertainty, RMS error | m |
| slperr | Slope uncertainty, RMS error | degrees |
| ldec | LOLA return count per pixel | count |

All five local files were inspected using Rasterio 1.5.2 on 2026-11-19.
They have identical CRS WKT and affine mapping: 3200 x 3200, float32, one band,
GDAL transform `[-9000,5,0,1000,0,-5]`, bounds X -9000..7000 m and
Y -15000..1000 m, scale 1, offset 0, NaN nodata, area registration.
Native CRS: south polar stereographic, origin -90 degrees, central meridian 0,
sphere radius 1737400 m, metre axes. TIFF datum name is unknown.
NASA README associates the products with MOON_ME/DE421 and pixel-centered GMT
registration. Band-unit tags are absent; units come from documentation.
Every returned center was round-tripped through each TIFF's native affine mapping.
This confirms internal grid alignment, not independent absolute registration.

Exact source hashes, sizes, tags, CRS, masks and reader versions are recorded in
`data/metadata/site04_terrain_inspection.json`. Hashes are local integrity pins,
not NASA-published checksums. Raw files remain in Downloads, outside Git.

## Returned subset and example

Rows/columns 1584..1615, matching the existing coverage window. Outer bounds:
X -1080..-920 m, Y -7080..-6920 m; native 5 m cells, 160 x 160 m subset.
No resampling, spatial interpolation, or new slope calculation is performed.

First returned cell (actual extracted values):

```json
{
  "row": 1584,
  "column": 1584,
  "bounds": {"min_x": -1080, "min_y": -6925, "max_x": -1075, "max_y": -6920},
  "elevation": {"value": 822.4229125976562, "unit": "m", "status": "available"},
  "slope": {"value": 35.205955505371094, "unit": "degree", "status": "available"},
  "elevation_rms_uncertainty": {"value": 0.5554645657539368, "unit": "m", "status": "available"},
  "slope_rms_uncertainty": {"value": 4.8952860832214355, "unit": "degree", "status": "available"},
  "observation_status": "unobserved"
}
```

Unobserved means zero local LOLA returns in the count map. NASA's SURF product
fills empty pixels by interpolation, so a surface model value may still exist.
Masked/NaN metrics return null/nodata; invalid metrics return null/unverified.
Missing values must render grey; do not infer a slope/height from other cells.

## Limits and next work

Status stays provisional. Surface Z vertical reference is not confirmed from the
supplied TIFF/README. The CRS sphere radius alone does not prove an elevation
datum. Slope baseline/derivation must be documented before interpreting it as a
site screening criterion. No lat/lon mapping is verified, so consumers must use
the source X/Y frame; this endpoint cannot supply arbitrary globe clicks yet.
No horizon, dated terrain illumination, RF availability, mission thresholds,
suitability score or recommendation is calculated. Horizons remains a separate
geometry provider. Existing mock analysis is still mock.

## Reproduce and verify

Use an existing environment with Rasterio, NumPy and backend requirements:

```powershell
python -B backend/scripts/prepare_site04_terrain.py C:/Users/nahul/Downloads
python -B backend/scripts/verify_site04_terrain.py
python -B backend/scripts/verify_backend.py
python -B backend/scripts/verify_geometry.py
```

Rasterio/NumPy are preprocessing tools only; deployment adds no GIS dependency.
The API reads at most 524289 bytes and verifies the artifact SHA-256 before
schema validation. Artifact pin:
`af715a84f5b494d3e04c7c844bbd1ea9da913aff26e5ef0e93bdf30178fadb0c`.
Regeneration changes require review before changing the provider's pin.
