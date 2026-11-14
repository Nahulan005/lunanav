# LunaNav Python backend

FastAPI foundation with typed Pydantic contracts and injectable Python provider
protocols. All four active providers are mocks. No NASA services, datasets, or SPICE
kernels are used. The React frontend still uses its existing local mock adapter;
adding this backend does not connect or change the frontend.

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

`.env` is ignored by Git. `CORS_ORIGINS` accepts comma-separated origins; defaults
are `http://localhost:5173` and `http://127.0.0.1:5173`. If Vite uses another port,
explicitly add its origin and restart the backend. Credentials are disabled.
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

The canonical [source registry](../docs/source-registry.json) remains unchanged and is
read locally for response references. Keep `docs/source-registry.json` with the backend
when packaging it. All five resources are acknowledged:

- NASA Moon Trek: discovery and visual reference.
- NASA LRO/LOLA: planned local elevation, slope, and horizon source.
- NASA LROC Data Products: planned imagery and surface context.
- NASA NAIF/SPICE: planned local Sun/Earth geometry toolkit and kernels.
- NASA Celestial Mapping System: terrain/profile/visibility planning reference.

See [architecture](../docs/architecture.md) for official URLs, limitations, and data flow.
There are no live integrations and no downloaded local NASA datasets. No public API
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
All three directories are empty apart from placeholders.

Next milestone: select one documented LOLA elevation product that covers one chosen
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
