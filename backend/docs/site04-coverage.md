# Site04 observation-coverage handoff

**Current update:** the bounded provisional artifact below supersedes the historical
unavailable-only description and preflight blocker. Schema and endpoint path are unchanged.

Consume `GET /api/v1/terrain/site04/coverage` (no query parameters yet).
HTTP 200 describes provider status; it does not imply data is available.
The response serves a pinned central 32x32 native window with `status: provisional`.
Missing or corrupt artifacts return `status: unavailable` and empty cells. The API
reads the compact derived JSON, never the raw TIFF. Copying a TIFF into the
repository does not activate ingestion. Existing endpoints remain unchanged.

Exact contract: [JSON Schema](site04-coverage.schema.json).
Unavailable fallback response: [example](site04-coverage.example.json).
Current populated response: `backend/data/processed/site04_coverage_window.json`.
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
- Missing/unverified cells render grey with a symbol. The populated response legend defines all four states using documented
  count semantics; the unavailable fallback legend defines only missing/unknown. Never interpolate or use demo values.
- The populated source includes product URL, supplied checksum, processing version
  and completed inspection checks. These remain unset in the unavailable fallback.
- Lat/lon rendering is blocked until source georeferencing and lunar-frame
  transformation are verified. Do not apply a terrestrial EPSG assumption.

## Geographic overlay gate (future work)

Native metadata inspection and bounded processing are recorded below. No
latitude/longitude transformation is verified: keep this grid in projected X/Y.
Regional window parameters and clipping remain future work; no request bounds
are accepted now. Provisional status exposes unresolved absolute registration
assumptions and must not be presented as scientific validation.

Coverage does not establish slope, terrain horizon, illumination, radio access,
landing suitability or a recommendation. This API only serves preprocessed observation counts.


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


## Integration verification (2026-11-16)

The existing backend verification script now checks the populated API response,
all 1024 native cell bounds and count semantics, summary, source checksum and
provisional status. It also simulates a missing artifact and checksum mismatch:
both must return HTTP 200 with unavailable status and empty cells. No GIS package
is imported by the API. Existing analysis remains mock.

The Moon3D page displays this response in a separate projected X/Y coverage
panel, never on the globe. Select a cell to inspect its source index, bounds and
count. API failure or invalid responses show unavailable with no demo substitute.
Configure the frontend VITE_API_BASE_URL to the backend origin before building;
without configuration the existing service uses http://127.0.0.1:8000.
For local development, run the existing backend and frontend commands in their
respective READMEs, then open #/landing-3d. Production packaging needs the tracked
derived JSON artifact; the external raw TIFF and Rasterio are unnecessary at runtime.


## Overall-risk overlay blocker (2026-11-16)

The frontend Overall Risk mode is an availability explanation, not a risk model.
It renders Unknown in grey, with no fixture scores, coloured risk classifications
or recommendations. Site04 LDEC contains return counts only. No Site04 slope,
horizon-by-azimuth, terrain-aware time-window illumination/visibility grid, shared
verified lat/lon registration, uncertainty model or configured mission thresholds
is connected. The coarse Apollo 17 cutout is a different location and scale; it
must not supply Site04 slope. Horizons directions remain point-in-time context.

A future risk API requires per-cell verified geographic bounds/frame, spatial
baseline and units for slope, terrain horizons/observer height, dated/time-sampled
Sun/Earth metrics and uncertainties, versioned mission requirements, per-criterion
pass/fail/unknown explanations, and source/checksum provenance. Mandatory failures
must not be compensated by weighted averages; any missing mandatory input must
preserve Unknown. Observation counts alone cannot provide an overall risk score.
The existing coverage contract and endpoint remain unchanged.
