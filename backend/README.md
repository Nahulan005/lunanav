# LunaNav Python backend

FastAPI foundation with typed Pydantic contracts and injectable Python provider
protocols. The mission-analysis service uses four mock providers. The independent
terrain sample and profile endpoints read the existing local LOLA LDEM_4 subset.
They make no external requests. This backend-only profile addition does not change
the existing frontend integration.

## Local LOLA terrain profile

`GET /api/v1/terrain/profile?latitude=20.19&longitude=30.77` returns a typed
`TerrainProfile`. It extends the existing sample response with up to four immediate
cardinal neighbors, minimum/maximum/range, grid resolution, and a coarse slope estimate.
`GET /api/v1/terrain/sample` keeps its existing implementation and response contract.

The dataset is the existing 8192-byte `data/raw/ldem_4_apollo17_cutout.bin`, with
unchanged labels and manifest in `data/metadata/`. The profile calls the existing
sample reader at most five times, retaining its coordinate mapping, 0.5 m/DN scale,
reference radius (1737400 m), checksum checks, validation, and coverage checks.
Source/product and full original/subset SHA-256 fields are inherited in the response.
The profile needs no new data, dependency, configuration, or service.

Coverage stays **12 < latitude <= 28; 24 <= longitude < 40** (degrees east).
Outside this coverage the center request returns HTTP 422 with
`detail.code = OUTSIDE_LOCAL_COVERAGE`. Invalid inputs remain 422; data failures
remain explicit 503 errors without synthetic substitution. A valid edge cell returns
its available neighbors and lists missing ones rather than extrapolating.

The selected center uses the original containing native angular-grid cell. It is
reported as `coordinate_used` separately from `coordinate_requested`; there is no
new geodesic nearest-neighbor search or interpolation. At grid-line ties the existing
north/west-inclusive, south/east-exclusive convention is preserved.

The profile consists of center, north, east, south, and west cells. Summary extrema
include only those available cells and do not describe the whole cutout. Neighbor
elevations use the same units and reference radius as the center. No nodata sentinel
is declared by this product; existing nodata status and limitations are retained.
Invalid/corrupt neighbor data fails the request instead of being silently omitted.

For the source's 0.25-degree grid, let `d = radians(0.25)` and let `phi` be the center
latitude. With reference radius `R = 1737400 m`:

```text
dy = R * d
dx = R * cos(phi) * d
g_north = (height_north - height_south) / (2 * dy)
g_east  = (height_east - height_west) / (2 * dx)
slope_deg = degrees(atan(hypot(g_north, g_east)))
```

All four cardinal neighbors are required. Otherwise `slope_deg` is null and
`slope_reason` names the missing neighbors. There is no one-sided fallback. Distance
uses the reference sphere, not terrain-following distance. This is an unvalidated
grid-gradient estimate over two-cell baselines, not within-cell terrain slope or
roughness. The source label's rounded projected spacing (7580.84 m) is reported
separately from the computed north/south and latitude-dependent east/west spacing.

`validation` retains the center sample's ingestion checks; it does not validate
the derived slope. `provenance.validation` is explicitly `unvalidated`. The original
single-cell limitations are retained as `source_limitations`; `limitations` describes
the profile's extended scope and keeps source accuracy and nodata caveats.

Expected values for the example request, derived by bounded inspection of the
existing local bytes (not an HTTP execution):

| Cell | Latitude | Longitude | Elevation (m) |
| --- | --- | --- | --- |
| Center | 20.125 | 30.875 | -2662.0 |
| North | 20.375 | 30.875 | -1481.0 |
| East | 20.125 | 31.125 | -2600.5 |
| South | 19.875 | 30.875 | -2714.5 |
| West | 20.125 | 30.625 | -2546.0 |

Minimum: -2714.5 m; maximum: -1481.0 m; range: 1233.5 m. Expected coarse slope:
approximately 4.6562612675 degrees. Neighbor-center spacing is approximately
7580.837606 m north/south and 7117.983599 m east/west at this center latitude.

This change was limited to static/import checks; no server or long verification
script was run for the profile milestone.

## Windows PowerShell setup

From the repository root, with Python 3.11+ installed:

```powershell
cd backend
python --version
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe scripts\verify_backend.py
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Use `python` from PATH; the Windows `py` launcher is optional. Activation is unnecessary,
so these commands also work when PowerShell activation scripts are blocked. Run the
server from `backend`, or use `--app-dir backend` from the repository root. Stop it
with Ctrl+C. Open `http://127.0.0.1:8000/docs` for the generated OpenAPI interface.

In another PowerShell terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health
$body = @{
    siteId = 'shackleton'
    latitude = -89.9
    longitude = 0
    landingDate = '2027-03-15'
} | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:8000/api/v1/analysis -Method Post -ContentType 'application/json' -Body $body
```

`.env` is ignored by Git. `CORS_ORIGINS` accepts a comma-separated allowlist
and replaces the defaults when set. Defaults include `https://lunanav.vercel.app`,
`http://localhost:5173`, and `http://127.0.0.1:5173`. GET, POST, and OPTIONS
are allowed with Content-Type and Authorization headers. Credentials are disabled;
use explicit origins, not wildcards. CORS does not authenticate requests.

For Render, set this environment variable and redeploy/restart:

```text
CORS_ORIGINS=https://lunanav.vercel.app,http://localhost:5173,http://127.0.0.1:5173
```

An existing Render value containing only localhost overrides the new defaults
and must be updated. Origins have no paths or trailing slash. If Vite uses another
port, add its exact origin to the list. This source change does not update Render's
environment variables or deploy the application automatically.
No API keys or external service credentials are required.

## Scientific dependencies

The mock server only needs `requirements.txt`. The separate planned science stack is:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-science.txt
```

This adds NumPy, Rasterio, and SpiceyPy, without downloading any datasets or kernels.
They are not imported or used by mock providers. If binary wheels are unavailable for
your Python release, use a Python release supported by all three packages rather
than attempting an unreviewed local GDAL build. Dependency ranges are foundation
constraints, not a reproducible production lock; pin a tested environment before deployment.

## API and contracts

- `GET /api/v1/health`: application liveness and mock mode, not scientific readiness.
- `POST /api/v1/analysis`: validates coordinates, date, optional `duration_days` (1–30),
  and `observer_height_m` (0–1000). The date labels a UTC fixture; it does not drive
  astronomical calculations. Invalid inputs return FastAPI's structured 422 response.
- `/docs` and `/openapi.json`: generated documentation and Python contract source.

Responses echo the request and include typed terrain, imagery, ephemeris, and
visibility results, per-provider provenance, warnings, and references to all five
NASA resources. `source_ids`, `dataset_ids`, and `kernel_ids` remain empty. References
are acknowledgements, not data-use claims. Finite numbers are required and unknown
fields are rejected. Requests do not cause filesystem downloads or external calls.

`app/providers/interfaces.py` defines TerrainProvider, EphemerisProvider,
ImageryProvider, and VisibilityAnalysisProvider. `app/api/routes.py` constructs the
mock service through a FastAPI dependency, so it can be overridden in tests or replaced
later. CPU-bound providers use synchronous methods; future large jobs need bounded
workers, cancellation, and caching rather than long-running HTTP requests.

Mock terrain and geometry contain fixed illustrative values; mock imagery contains
no asset; mock visibility contains one illustrative classification, without a terrain
comparison. The one timestamp is not coverage of the requested duration. No duration
summary, feasibility score, or safety rating is produced. Geometric Earth visibility
does not prove a radio link. Both communication and mission assessment are unassessed.

Before enabling a real provider, extend the mock-only response mode and reference-use
semantics, record dataset/kernel provenance, and validate frames, datum, time coverage,
and calculation behavior. The current service rejects non-mock provider results rather
than mislabeling them. Never silently fall back from real-data errors to mocks.

## NASA sources and retained TypeScript contracts

The canonical [source registry](../docs/source-registry.json) is
read locally for response references. Keep `docs/source-registry.json` with the backend
when packaging it. All five resources are acknowledged:

- NASA Moon Trek: discovery and visual reference.
- NASA LRO/LOLA: planned local elevation, slope, and horizon source.
- NASA LROC Data Products: planned imagery and surface context.
- NASA NAIF/SPICE: planned local Sun/Earth geometry toolkit and kernels.
- NASA Celestial Mapping System: terrain/profile/visibility planning reference.

See [architecture](../docs/architecture.md) for official URLs, limitations, and data flow.
The registry's planned-only LOLA status predates the existing local cutout and has
not been edited by this backend-only change. The sample/profile endpoints use that
cutout; the other resources remain references or future integrations. No public API
is assumed for these resources, and NASA data alone does not validate derived results.

`src/providers.ts`, `src/mockProviders.ts`, and `tsconfig.json` are retained **contract
prototypes**, not executable scientific backend components. Python schemas/OpenAPI
now define this HTTP foundation. They intentionally include an explicit mock API
envelope and do not promise field-for-field parity with the earlier prototypes.
After the real API stabilizes, generate frontend types from OpenAPI and remove the
prototypes in a reviewed migration only after checking all consumers. The existing
frontend adapter must be updated explicitly when integration is requested.

## Data layout and next real-data milestone

`data/raw/`: immutable downloaded source products and labels (ignored by Git).
`data/processed/`: derived subsets (ignored by Git).
`data/metadata/`: small provenance manifests suitable for review and version control.
The existing raw cutout and metadata are retained unchanged; see the profile section
above for their current use.

Original acquisition milestone (already completed for the existing cutout): select one documented LOLA elevation product that covers one chosen
coordinate, obtain its label and file manually from a verified official archive link,
and record product ID, source URL, checksum, frame, projection, datum, scale/offset,
nodata, bounds, and native pixel spacing. Use Rasterio to transform that coordinate
into the product CRS and read exactly one valid pixel, applying documented scaling.
Return the elevation in declared units with the pixel index and manifest reference.
Verify the coordinate round trip, bounds, nodata behavior, and the value against the
source raster. Mark it local-derived and unvalidated until benchmarked. This milestone
does not include SPICE, slope, horizon, visibility, or feasibility claims.

## Verification

`scripts/verify_backend.py` uses FastAPI TestClient (no external calls) to check package
imports, route registration, valid responses, invalid inputs, fixture independence
from coordinates, provenance, all five references, CORS, and generated OpenAPI.
It does not validate lunar science or replace a production deployment test.
Add `--http` to also start a temporary Uvicorn server on an ephemeral loopback port,
probe its health over HTTP, and stop it automatically.
