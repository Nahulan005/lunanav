# LunaNav Python backend

FastAPI foundation with typed Pydantic contracts and injectable Python provider
protocols. The analysis endpoint uses four mock providers. A separate terrain sample
endpoint now reads one real elevation from a local NASA LOLA subset. No live NASA
services or SPICE kernels are used. The React frontend still uses its existing local
mock adapter and is unchanged.

## Windows PowerShell setup

From the repository root, with Python 3.11+ installed:

```powershell
cd backend
python --version
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe scripts\prepare_lola_sample.py
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

- `GET /api/v1/health`: application liveness; its `mode: mock` describes the analysis service, not dataset readiness.
- `GET /api/v1/terrain/sample?latitude=20.19&longitude=30.77`: one locally sourced LOLA elevation with requested/used coordinates, units, hashes, and validation status.
- `POST /api/v1/analysis`: validates coordinates, date, optional `duration_days` (1–30),
  and `observer_height_m` (0–1000). The date labels a UTC fixture; it does not drive
  astronomical calculations. Invalid inputs return FastAPI's structured 422 response.
- `/docs` and `/openapi.json`: generated documentation and Python contract source.

Mock analysis responses echo the request and include typed terrain, imagery, ephemeris, and
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

Before enabling a real provider in the analysis service, extend its mock-only response mode and reference-use
semantics, record dataset/kernel provenance, and validate frames, datum, time coverage,
and calculation behavior. The current service rejects non-mock provider results rather
than mislabeling them. Never silently fall back from real-data errors to mocks.

## NASA sources and retained TypeScript contracts

The canonical [source registry](../docs/source-registry.json) retains all five resources,
with the local LOLA ingestion status updated. It is read locally for response references.
Keep `docs/source-registry.json` with the backend
when packaging it. All five resources are acknowledged:

- NASA Moon Trek: discovery and visual reference.
- NASA LRO/LOLA: local elevation sample; slope and horizon remain planned.
- NASA LROC Data Products: planned imagery and surface context.
- NASA NAIF/SPICE: planned local Sun/Earth geometry toolkit and kernels.
- NASA Celestial Mapping System: terrain/profile/visibility planning reference.

See [architecture](../docs/architecture.md) for official URLs, limitations, and data flow.
There are no live NASA integrations. One bounded LOLA dataset is available locally.
No public API is assumed for these resources, and NASA data alone does not validate derived results.

`src/providers.ts`, `src/mockProviders.ts`, and `tsconfig.json` are retained **contract
prototypes**, not executable scientific backend components. Python schemas/OpenAPI
now define this HTTP foundation. They intentionally include an explicit mock API
envelope and do not promise field-for-field parity with the earlier prototypes.
After the real API stabilizes, generate frontend types from OpenAPI and remove the
prototypes in a reviewed migration only after checking all consumers. The existing
frontend adapter must be updated explicitly when integration is requested.

## Real LOLA milestone: exact source and method

Source: NASA LRO/LOLA **LDEM_4 V3.0**, from the
[official PDS Geosciences archive](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_4.img),
with companion [PDS3](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_4.lbl)
and [PDS4](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_4.xml)
labels. NASA instrument reference: https://science.nasa.gov/mission/lro/lola/.

The preparation script downloads only a 2,073,600-byte coarse grid and two small
labels, with hard size caps. The original IMG is processed in memory and discarded;
only a 64x64 subset (8192 bytes) is saved. No large global product is retained.

- `data/raw/ldem_4_apollo17_cutout.bin`: original unresampled SignedLSB2 cells, ignored by Git.
- `data/metadata/ldem_4.lbl` and `ldem_4.xml`: unchanged official labels describing the original product, not the subset.
- `data/metadata/lola_sample_manifest.json`: source URLs, original/subset/label SHA-256 hashes, dimensions, CRS, crop, conversion, checks, and limitations.
- `data/metadata/terrain_sample_response.json`: actual response captured from Uvicorn by verification.
- `data/processed/`: reserved and empty.

Windows Application Control blocked Rasterio's native DLL, even outside the sandbox.
No security settings were changed. This narrow provider uses Python's standard
library to read the label-specified binary grid instead. It supports only the audited
LDEM_4 format, not arbitrary rasters. No extra packages beyond `requirements.txt` are
needed for the sample endpoint or acquisition script.

The source has 720 rows and 1440 columns, signed little-endian 16-bit values, no
header, pixel registration, and exactly 4 pixels/degree. CRS is lunar simple
cylindrical/equirectangular (central meridian 180°, standard parallel 0°, sphere
radius 1737400 m), in the **MEAN EARTH/POLAR AXIS OF DE421** frame. Latitude is
planetocentric; longitude is positive-east (source 0–360°, API −180–180°).
Inputs must already use that lunar frame. No terrestrial EPSG transform is applied.

Height is **DN × 0.5 metres** above the 1737400 m reference sphere. The label's
1737400 m offset converts to planetary radius and is **not added to elevation**.
Neither label defines a nodata sentinel. All file values fall within the declared
range; response status is `not-flagged-no-sentinel-declared`, not a guarantee that
every source cell represents an independent observation.

Lookup uses `row=floor((90-latitude)*4)`, `column=floor((longitude % 360)*4)`.
Subtract source offsets `(248,96)` for the subset pixel. The raw value is read at
byte offset `2*(subset_row*64+subset_column)`. Used cell center is
`latitude=90-(row+0.5)/4`, `longitude=(column+0.5)/4`. The bounded endpoint accepts
**12 < latitude ≤ 28; 24 ≤ longitude < 40**. Grid lines follow north/west inclusive,
south/east exclusive behavior. It returns a containing-cell value without interpolation.

The verified example maps `(20.19,30.77)` → source pixel `(279,123)` → center
`(20.125,30.875)` → pixel `(279,123)`. Original bytes and subset agree on DN −5324,
which yields **−2662.0 m**. See the architecture document for the complete audit.

Reproduce from `backend`:

```powershell
.\.venv\Scripts\python.exe scripts\prepare_lola_sample.py
.\.venv\Scripts\python.exe scripts\verify_backend.py --http
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
# In another terminal:
Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/terrain/sample?latitude=20.19&longitude=30.77'
```

Concise excerpt of the actual response:

```json
{
  "mode": "local-derived",
  "product_name": "LDEM_4",
  "product_version": "V3.0",
  "coordinate_requested": {"latitude": 20.19, "longitude": 30.77},
  "coordinate_used": {"latitude": 20.125, "longitude": 30.875},
  "raw_dn": -5324,
  "scale_factor": 0.5,
  "elevation_value": -2662.0,
  "units": "m",
  "checksum": "c04632eba6449af49e3108ed7c25b3b1c450600abd3690df4fc815853a1af476",
  "validation": {"status": "ingestion-verified-not-scientifically-validated"}
}
```

Limitations: 0.25° grid (label projected spacing 7580.84 m/pixel) is coarse context,
not landing-scale terrain. Spacing does not establish elevation accuracy. The full
file minimum is −17757 DN versus −17758 in the label: an unexplained one-DN/0.5 m
discrepancy retained in metadata; values were not adjusted. Labels warn of possible
45° latitude-band edge artifacts. Checksums are locally computed integrity records,
not independently published NASA hashes. No slope, horizon, heatmap, SPICE, landing
ellipse, sensitivity analysis, communication, or safety assessment is implemented.

Requests are offline. Missing/corrupt/unsupported data returns 503; invalid or
outside-coverage coordinates return 422. There is no fabricated or mock fallback.
The ingestion script refuses changed source hashes on repeat downloads.

## Verification

`scripts/verify_backend.py` uses FastAPI TestClient (no external calls) to check package
imports, route registration, valid responses, invalid inputs, fixture independence
from coordinates, provenance, all five references, CORS, and generated OpenAPI.
It also verifies the real sample's scaling, coordinate round trip, bounds, hashes,
and missing/corrupt-file errors. The local LOLA preparation must have succeeded first.
It does not validate lunar science or replace a production deployment test.
Add `--http` to also start a temporary Uvicorn server on an ephemeral loopback port,
probe health and the real terrain sample over HTTP, save the sample response, and
stop it automatically.
