# Site04 observation-coverage handoff

**Current update:** the bounded provisional artifact below supersedes the historical
unavailable-only description and preflight blocker. Schema and endpoint path are unchanged.

Consume `GET /api/v1/terrain/site04/coverage` (no query parameters yet).
HTTP 200 describes provider status; it does not imply data is available.
The response currently always has `status: unavailable`, empty cells and null
unverified metadata. It does not inspect or read TIFFs. Copying a TIFF into the
repository will not activate ingestion. Existing endpoints remain unchanged.

Exact contract: [JSON Schema](site04-coverage.schema.json).
Exact current response: [example](site04-coverage.example.json).
FastAPI also exposes the model through `/openapi.json`.

## Renderer interpretation

- Only `observation_coverage` is supported; no elevation or suitability scores.
- Coordinate units and lunar frame are explicit fields, initially null.
  Bounds use x/y in that verified frame, never implicitly longitude/latitude.
- Native and returned resolutions describe spacing, units, rows and columns.
  No spacing or extent is assumed before GeoTIFF metadata inspection.
- Cells carry source-window row/column, source-frame bounds, value/unit and
  observed/unobserved/nodata/unverified status. No cells can be placed without
  verified mapping; return an empty array until then. Count ceiling: 4096.
- Coverage summary counts apply to the returned window. Percentage is
  100 * observed / valid, excluding nodata/unverified pixels; it remains null
  until observation semantics are established, or when valid count is zero.
- Null nodata_value with unverified nodata_status means unknown sentinel.
- Missing/unverified cells render grey with a symbol. The current legend only
  defines these states; observed/unobserved legend entries must be added with
  documented value semantics later. Never interpolate or use demo values.
- Source includes an instrument reference only. Product download URL, checksum,
  processing version and validation checks remain unset until evidenced.
- Lat/lon rendering is blocked until source georeferencing and lunar-frame
  transformation are verified. Do not apply a terrestrial EPSG assumption.

## Activation gate (future work)

Inspect the real TIFF and authoritative product documentation for frame, affine
transform, pixel registration, dimensions, units, nodata/masks and observation
semantics. Record exact source URL/checksum and bounded processing provenance.
Implement bounded regional window parameters and clipping in a later change;
no request bounds are accepted now. Provisional status must expose unresolved
assumptions and must not be presented as validated data. Status fields reserve
future states; this route currently emits only unavailable.

Coverage does not establish slope, terrain horizon, illumination, radio access,
landing suitability or a recommendation. No terrain processing occurs here.


## Local source preflight (2026-11-15; ingestion blocked)

The user-supplied external file
`C:\Users\nahul\Downloads\Site04_final_adj_5mpp_ldec.tif` was checked
with a streaming SHA-256 read in 1 MiB chunks; it was not copied into Git.

- Exact size: 40,980,740 bytes (matches supplied size).
- SHA-256: `FCC8C2219AE2368D5B2A1F6AEC05FCF96CF725F3035AC8D80EFC312A4FF29227`
  (matches supplied checksum; not claimed to be a NASA-published checksum).
- Official product page: https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/
- Official file URL: https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_ldec.tif

The NASA product page describes LDEC as LOLA spot counts per pixel and the
rasters as nominal 5 m/pixel south polar stereographic X/Y metres, MOON_ME,
DE421. These are documentation claims, not locally inspected TIFF metadata.
No counts, valid mask, zero-count semantics, dimensions, transform, bounds,
CRS tags, pixel registration, dtype, nodata sentinel, or band units were verified.
No regional window or returned cell positions have therefore been selected.

The available Python reports no `rasterio`, `osgeo`, `numpy`, or `fastapi`.
This checkout has no `backend/.venv`; `gdalinfo` is not on PATH. No packages
were installed, no TIFF cells processed, and no CSVs or alignment scripts used.
Checksum agreement alone cannot establish geographic registration or count
semantics. The API and its exact schema/example remain unchanged and unavailable.

Next action: make an existing Rasterio/GDAL-capable runtime available, inspect
GeoTIFF metadata and masks, reconcile them with the official documentation,
and only then choose a native bounded window of at most 4096 cells. Until that
gate passes, render no georeferenced coverage and no inferred lat/lon positions.


## Bounded working result (2026-11-15)

`GET /api/v1/terrain/site04/coverage` now serves a pinned, 193707-byte JSON artifact
with `status: provisional`, `layer: observation_coverage`, and 1024 native cells.
No query parameters, frontend integration, or heavy GIS runtime dependency added.
Missing/changed/invalid artifact returns `unavailable` and zero cells, never fixtures.
The earlier unavailable example remains a valid fallback example, not the current
successful response. The JSON Schema and Python response models are unchanged.

### Actual inspection

Rasterio 1.5.2 inspected the checksum-matching external TIFF:

- 3200 columns x 3200 rows, one float32 band; scale 1, offset 0.
- GDAL affine: `[-9000, 5, 0, 1000, 0, -5]`.
- Outer source bounds: X -9000..7000 m, Y -15000..1000 m.
- CRS: south polar stereographic, latitude of origin -90, central meridian 0,
  false easting/northing 0, spherical radius 1737400 m; linear units metre.
- TIFF datum name is `unknown`. NASA README supplies MOON_ME/DE421 association;
  this is documented provenance, not an independently validated frame tie.
- `AREA_OR_POINT=Area`, GMT `node_offset=1`, and history `xyz2grd ... -I5 ... -r`.
  Source-frame cell centers use `(column+0.5,row+0.5)` and bounds use corners.
  NASA README independently documents GMT pixel-centered registration.
- Nodata is NaN; GDAL nodata mask inspected. Band-unit tag is absent.
  Unit `LOLA returns per pixel` comes from NASA's documented LDEC definition.
- SHA-256 matches the supplied pin; this is not a NASA-published checksum claim.

Full tags, WKT, runtime versions and mask flags are recorded in
`backend/data/metadata/site04_coverage_inspection.json`.

### Fixed window and semantics

Selected the central 32x32 window, source rows/columns 1584 through 1615 inclusive.
This follows the midpoint of verified source dimensions, not a search for high
coverage or a landing target. Returned outer bounds are X -1080..-920 m,
Y -7080..-6920 m: 160 x 160 m at native 5 m spacing. Cell row/column indices
refer to the original TIFF. All 1024 center coordinates round-trip through its
native affine transform. No geographic reprojection or alignment script used.

Returned counts: 1024 valid, 88 observed (>0 integral count), 936 zero-count
unobserved, 0 nodata, 0 unverified. Coverage is 8.59375% of this window's valid
pixels only. It is not whole-Site04 coverage. NaN/masked values become nodata;
negative, fractional or other nonfinite values become unverified. Null values
and grey legend entries preserve missing/invalid data without interpolation.
`nodata_value: null` is required because the schema disallows NaN; the mask-defined
status and limitations explicitly document the actual NaN sentinel.

### Reproduce

Use an isolated Python environment with binary Rasterio 1.5.2 and existing backend
requirements. Rasterio/NumPy are preprocessing tools only; deployment requirements
are unchanged. From the repo root:

```powershell
.\backend\.venv\Scripts\python.exe -B backend/scripts/prepare_site04_coverage.py C:/Users/nahul/Downloads/Site04_final_adj_5mpp_ldec.tif
.\backend\.venv\Scripts\python.exe -B backend/scripts/verify_backend.py
```

The script streams the source checksum in 1 MiB chunks, checks metadata, and reads
only the bounded value/mask window. It writes the compact derived artifact and
inspection audit; no raw NASA TIFF enters Git. The API reads at most 262145 bytes,
checks the pinned artifact SHA, and validates the unchanged Pydantic contract.
Regeneration that changes serialization must be reviewed before updating its pin.

Artifact SHA-256:
`63fe56171921c817a64de8e5be794f320ae9ceb10a711b57cd59fb866a691a67`.
Ensure the derived JSON is included in any later authorized commit/deployment.

### Renderer handoff and limits

Render only returned cell bounds in the documented source X/Y metre frame; use
observation_status and the supplied legend. No lat/lon transform is verified, so
geographic Moon overlay remains blocked. `coordinate_system.status=verified`
refers to inspected native affine/CRS mapping supported by NASA's frame description;
response/source validation remains provisional, not scientific validation.

This layer contains observation counts, not elevation or elevation datum, slope,
horizon, illumination, RF availability, landing suitability, risk or recommendations.
The existing illustrative scenario-comparison visualization is unchanged.
