# Regional Site04 access

## API and configuration

Existing `GET /api/v1/terrain/site04/grid` without query parameters still returns
the fixed central artifact. Existing sample/profile/coverage routes are unchanged.

New optional geographic query:

```
GET /api/v1/terrain/site04/grid?latitude=-89.7668&longitude=-171.87&width=32
GET /api/v1/terrain/site04/footprint
```

Both latitude and longitude are required together, in documented MOON_ME/DE421
spherical planetocentric coordinates, degrees east in [-180,180]. Width is an
integer 1..32; requests return at most 1024 cells. At a raster edge the requested
window shifts inward, preserving native cells and requested size. The response
reports requested coordinates, nearest cell, actual returned bounds, native
indices, per-cell geographic centers, all five source hashes and limitations.
Outside-source coordinates return HTTP 422 `OUTSIDE_SITE04_COVERAGE`; incomplete
coordinate pairs return 422 `COORDINATE_PAIR_REQUIRED`.

The optional regional reader requires the five original external TIFFs and an
environment with `requirements-terrain.txt` installed. No packages were installed
for this change: an existing Rasterio environment was used. Set before launching:

```powershell
$env:SITE04_DATA_DIR='C:/Users/nahul/Downloads'
# Use an existing GIS-capable backend environment:
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

No server was started during verification. Each source is checksum verified on
first use and again after its filesystem stat signature changes. Only the small
requested value/mask windows are read into arrays; streaming checksums scan file
bytes without loading entire rasters. Five TIFFs total about 205 MB, stored outside
Git. Unconfigured directory, missing GIS reader, invalid metadata or checksum
failure returns unavailable with no cells. Fixed artifacts need no GIS runtime.
Production needs explicit data provisioning and optional reader dependencies;
deploying code alone does not upload these local TIFFs or activate the reader.

## Geographic evidence and verification

Official products and README:
https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/
https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/README

Projection reference: https://proj.org/en/stable/operations/projections/stere.html

Inspected native CRS: sphere R=1737400 m; south-polar stereographic, true scale
at -90 degrees, longitude origin zero, no false offsets. Therefore:

```
rho = 2 R tan((pi/2 + latitude_radians)/2)
x = rho sin(longitude_radians)
y = rho cos(longitude_radians)
latitude = -pi/2 + 2 atan2(hypot(x,y),2R)
longitude = atan2(x,y)
```

The independent GDAL/PROJ transform was checked at 24 geographic pairs, including
the pole and cardinal/antimeridian longitudes. Maximum projected disagreement:
1.74e-10 m in the local runtime. Axis-sign assertions, inverse checks, geographic
cell-center to native-bound checks, distant windows, edge clipping and direct
TIFF-value comparisons are included in `scripts/verify_site04_windows.py`.
This establishes implementation consistency with the inspected projection.
It is not an independent survey or image-based geolocation validation. The
TIFF's unknown datum name is associated with MOON_ME/DE421 via NASA documentation;
no conversion between lunar ephemeris-dependent frames is performed. The meaning
of `lat_lon_transform_verified=true` is mathematical projection verification only.
Vertical reference, slope baseline and absolute registration remain provisional.

The footprint endpoint densifies all four inspected raster edges; it intentionally
does not provide a naive latitude/longitude bounding box because the raster
contains the south pole. Its centre is the inverse projection of X=-1000,Y=-7000 m,
not an invented landing candidate. A footprint does not imply valid observations
in every pixel. Out-of-footprint selections must not be clamped to real data.

## Frontend handoff

Open `#/coverage` -> Explore Site04 terrain. The centre button updates the shared
selected coordinates. Clicking the grey source footprint requests another small
window. The 32x32 native display supports cell selection, source-value details,
elevation/slope modes, units and local data-range legend. Grey denotes unqueried,
missing or invalid data, never a fabricated fill. All slope colours represent
magnitude only, not risk or a mission threshold. API failures show no demo fallback.
Backend `SITE04_DATA_DIR` and frontend `VITE_API_BASE_URL` must be configured in
their respective environments. Requests follow existing API-base behavior.

The Moon3D view now has an optional Real Site04 elevation overlay. Native X/Y
cell corners are transformed to geographic coordinates and projected through the
same sphere/rotation as selections and preset markers. A regional magnification
of 12000 makes the 160 m window readable without enlarging its geographic extent.
At whole-Moon scale this remains a sphere colour overlay. Regional zoom now
replaces that view with an orbitable perspective mesh whose native cell-centre
positions are (east X, surface Z, minus north Y), all in metres at 1x scale.
The midrange elevation is subtracted as a display origin only; original values
are preserved in inspection. Only quads with four valid adjacent samples create
triangles; missing samples leave holes. Triangles linearly connect source sample
centres for rendering, with no API resampling or gap filling. The mesh spans cell
centres, not an extrapolated outer half-cell border. It is a local projected
terrain view, not a claim to know an absolute lunar radius from unresolved Z datum.
It supports orbit, zoom, pan, reset, wireframe and nearest-vertex inspection;
the sample selector provides keyboard access to the same source values. Sample
inspection does not move the requested geographic window. Unknown/unqueried areas
stay unavailable. Real elevation is kept
separate from demo patches and suitability modes. The original whole-Moon scale,
rotation and reset remain available; regional drag sensitivity scales with zoom.

Independent NASA reference: Lunar Surface Data Book, table of south-pole features,
lists R04/Site04 Shackleton Rim at -89.7668 degrees, -171.87 degrees:
https://ntrs.nasa.gov/api/citations/20250002845/downloads/M2M-30044%20Lunar%20Surface%20Data%20Book%20Baseline_Final.pdf?attachment=true
This named-site reference maps near the TIFF footprint centre and supports
geographic consistency, not a pixel-level survey or a measured registration
error. Projection tests use GDAL/PROJ independently; the product remains provisional.
The source Moon albedo is decorative and must not be used as an alignment oracle.

Horizons remains independent context; no terrain horizon, illumination schedule,
RF availability, suitability score or recommendation is introduced.

Deployment preparation is in [Render instructions](site04-render-deployment.md).

## Bounded checks

```powershell
$env:SITE04_DATA_DIR='C:/Users/nahul/Downloads'
python -B backend/scripts/verify_site04_windows.py
python -B backend/scripts/verify_site04_terrain.py
python -B backend/scripts/verify_backend.py
python -B backend/scripts/verify_geometry.py
cd frontend
npm.cmd run build
```
