# LunaNav scientific systems architecture

## Current implementation and status

The React/TypeScript/Vite frontend is a working illustrative demo. Its mock metrics,
timeline, scenario explanations, CSS Moon, and local delayed analysis adapter remain
unchanged. None use NASA observations. The Python FastAPI foundation now implements
LunaNav-owned `GET /api/v1/health` and `POST /api/v1/analysis` routes in explicit mock
mode. A separate `GET /api/v1/terrain/sample` now returns one real elevation from a
bounded local LOLA subset. The frontend remains disconnected from these routes and
uses its local adapter. The analysis service is still entirely mock-only.

`backend/src/providers.ts` retains prototype contracts. `mockProviders.ts` supplies
network-free placeholders returning absent data or unknown visibility, with explicit
mock provenance. They are deliberately not wired into the existing frontend fixtures.
Empty results and nulls do not mean zero elevation, darkness, or a blocked Earth.

The active Python contracts live in `backend/app/schemas/analysis.py` and provider
protocols in `backend/app/providers/interfaces.py`. Their mock implementations return
fixed illustrative fixtures with explicit provenance, not scientific calculations.
See [backend setup and verification](../backend/README.md). The Python API envelope
is authoritative for the new HTTP foundation; the TypeScript prototypes are retained
until consumers can migrate to generated OpenAPI types.

## Sources and acknowledgement

See [source-registry.json](source-registry.json) for official URLs, proposed roles,
statuses, and limitations. NASA resources informing the architecture are:

- [Moon Trek](https://trek.nasa.gov/moon/): discovery and visual comparison reference.
- [LRO/LOLA](https://science.nasa.gov/mission/lro/lola/): one local elevation sample integration; broader terrain analysis remains planned.
- [LROC through LRO Data Products](https://science.nasa.gov/mission/lro/data-products/): prospective image context.
- [NAIF/SPICE](https://naif.jpl.nasa.gov/naif/): prospective local geometry toolkit and kernels.
- [Celestial Mapping System](https://celestialmappingsystem.arc.nasa.gov): mapping, profile, visibility, and planning workflow reference.

LOLA is now used by the standalone sample endpoint; all other resources remain
planned integrations or references. One small local LOLA cutout and original labels
are retained. No SPICE kernels are downloaded. Request handling calls no NASA service;
only the explicit offline acquisition script accesses the official archive.
NASA provenance does not imply endorsement, scientific validation, or landing safety.

## Free-first deployment

Start with one local workstation, an offline preprocessing command, files on disk,
and a small local service when the first scientific provider is ready. Proposed
scientific runtime: Python with Rasterio/GDAL, NumPy, and SpiceyPy. These are optional
future-runtime dependencies in `backend/requirements-science.txt`; the mock API needs
only `backend/requirements.txt`. The real LDEM_4 sample also uses only the Python
standard library; Windows Application Control blocked Rasterio's native DLL even
outside the sandbox. Rather than changing that policy, this milestone uses a strict
reader for the documented SignedLSB2 grid. No generic raster or SPICE processing is enabled.
Python schemas and generated OpenAPI define the HTTP boundary; retain TypeScript
prototypes for review rather than importing them into the Python engine.

Keep original products immutable outside source control. Store derived subsets,
checksums, metadata, and job manifests in a local cache; SQLite can track jobs later.
Use one bounded worker with explicit maximum region size and time samples. Cache by
dataset hashes, coordinates, algorithm version, kernels, and requirements. A paid
database, queue, cloud GIS service, or API key is unnecessary for the first milestone.
Free software does not eliminate storage, compute, bandwidth, or product-use constraints.
Verify applicable source terms and attribution before redistribution.

## Data flow

NASA source data
→ preprocessing and coordinate handling
→ scientific calculations
→ mission requirements
→ scenario comparison
→ explainable result
→ frontend visualization

1. **Source data:** manually choose specific LOLA and LROC archive products and SPICE
   kernels through documented official links. Do not synthesize download URLs.
2. **Preprocessing:** verify checksums and retain product labels. Record product ID,
   version, acquisition information, footprint, native pixel spacing and units,
   nodata, projection, frame, vertical datum, and processing history. Clip a region
   plus a horizon buffer; do not silently upsample and claim higher resolution.
3. **Coordinates:** normalize longitude explicitly; use planetocentric east-positive
   latitude/longitude at the provider boundary. Convert the product's convention and
   projection explicitly, including polar and longitude-wrap cases. Select the exact
   lunar body-fixed frame and orientation model; do not silently equate distinct
   lunar frames. Record radius/datum and distinguish height above terrain from
   elevation relative to a reference surface. Unknown required metadata blocks analysis.
4. **Calculations:** derive slope at a declared baseline; build horizon angles by
   azimuth with recorded range and sampling. Handle lunar curvature and observer height.
   Obtain Sun/Earth directions using compatible SPICE position/orientation/frame and
   leap-second kernels. Convert UTC to the toolkit's time representation explicitly;
   verify full kernel coverage and record aberration correction. Transform directions
   into the same local horizon convention as terrain (north-zero, clockwise azimuth).
5. **Visibility:** compare target elevation with terrain horizon plus an explicit
   angular margin. Missing terrain/geometry produces unknown, not favorable. Initial
   center-point geometry excludes solar/terrestrial disk extent; later models may
   include partial-disk visibility. Sampling cannot resolve events shorter than its
   interval; refine transitions and report timing uncertainty before duration claims.
6. **Requirements:** use versioned mission-specific thresholds for minimum illumination,
   maximum darkness, minimum geometric Earth access, terrain constraints, and acceptable
   unknown coverage. These thresholds are user assumptions, not NASA safety criteria.
7. **Comparison and explanation:** compare equal time windows and data quality. Return
   per-constraint measured values, units, threshold, margin, pass/review/fail/unknown,
   reason, and provenance. Preserve unknown as a separate outcome. Prefer these
   explanations to a composite score; any later score requires a published heuristic.
8. **Visualization:** display derived values, coverage, caveats, and attribution with
   source badges distinguishing mock, local-derived, and reference-only material.
   Do not relabel the current demo metrics as scientific results.

## Provider boundaries and replacements

| Contract | Current placeholder | Planned replacement |
| --- | --- | --- |
| TerrainProvider | MockTerrainProvider for analysis; LolaTerrainProvider for one local elevation sample only | Broader local raster sampling, slope and horizon processing |
| ImageryProvider | Python MockImageryProvider: no image | Local LROC-derived assets and metadata after product review |
| EphemerisProvider | Python MockEphemerisProvider: one fixed geometry fixture | Local SPICE computations over pinned kernels |
| VisibilityAnalysisProvider | Python MockVisibilityAnalysisProvider: fixed illustrative classifications | Derived terrain/geometry comparison with coverage checks |

Terrain and imagery are distinct; imagery is not required for a numeric terrain
calculation. Moon Trek and CMS are reference tools, not default data providers.
No public API is assumed for either portal. SPICE library APIs are not REST endpoints.
The contracts return provenance and explicit nulls/coverage; errors such as missing
products, invalid inputs, incomplete kernel intervals, or incompatible frames must
surface to callers. A real provider must never silently fall back to a mock.

The future service should validate coordinates, finite units, date ranges, frame
compatibility, resource limits, and dataset coverage at ingress. Visibility jobs must
also verify terrain and ephemeris belong to the same site and observer configuration;
record the full request in the job manifest. Preserve kernel names/checksums, algorithm
versions, and input hashes so the result can be reproduced.

## Communication and validation limits

Geometric Earth visibility means only that a modeled direction clears a modeled
horizon. It does not establish a radio link. Communication requires station geometry,
antenna pointing and patterns, frequency, power, receiver sensitivity, link budget,
availability, and potentially relay geometry. The contract always returns radio
communication as `not-assessed`; no blackout duration is promoted to a radio outage.

NASA-origin data does not automatically validate derived results. Test coordinate
round trips, units and datums, flat and synthetic ridge horizons, polar cases,
missing cells, time boundaries, kernel coverage, and analytic visibility cases.
Then benchmark against an independent calculation with matched inputs and quantify
discrepancies. Portal screenshot agreement is contextual evidence, not validation.
Keep `unvalidated` until documented benchmark criteria are satisfied; `benchmarked`
still does not imply flight qualification or a safety rating.

## Completed milestone: one bounded LOLA elevation sample

Official starting point: [NASA LRO/LOLA](https://science.nasa.gov/mission/lro/lola/).
Product: **LDEM_4 V3.0**, dataset `LRO-L-LOLA-4-GDR-V1.0`, PDS4 identifier
`urn:nasa:pds:lro_lola_rdr:data_gridded:ldem_4`, produced by the LOLA team at Goddard.
Source [IMG](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_4.img),
[PDS3 label](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_4.lbl),
and [PDS4 label](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_4.xml)
are hosted by NASA's PDS Geosciences Node. Acquisition is capped at 2,073,600 bytes
for the IMG and 45,000 bytes total for the labels. The full coarse global grid is
held in memory only; no large global raster is downloaded or retained.

| Property | Verified interpretation |
| --- | --- |
| Storage | SignedLSB2: signed little-endian 16-bit; row-major; no image header; 720 rows × 1440 columns |
| Units / scale | Height in metres = DN × 0.5; elevation offset = 0 |
| Datum | Height above a 1,737,400 m sphere; label OFFSET is used only for planetary radius, not elevation |
| CRS | Simple cylindrical / equirectangular, central meridian 180°, standard parallel 0°, lunar sphere; no Earth EPSG code |
| Lunar frame | MEAN EARTH/POLAR AXIS OF DE421, body-fixed rotating |
| Coordinates | Planetocentric latitude, east-positive longitude; source 0–360°, API −180–180° |
| Grid | Pixel registered, 4 pixels/degree (0.25°); label projected spacing 7580.84 m/pixel, not a claim of accuracy |
| Nodata | Neither label declares a sentinel; null metadata does not mean zero is missing. All DNs lie within declared extrema |
| Retained region | 64 × 64 original DNs, source rows [248,312), columns [96,160), 8192 bytes, no resampling |
| API coverage | 12 < latitude ≤ 28 and 24 ≤ longitude < 40 degrees east |

The original labels and all source URLs/SHA-256 hashes are saved in
`backend/data/metadata/`. `lola_sample_manifest.json` records the crop, numeric
conventions, validation checks, software, and limitations. The only local data file is
`backend/data/raw/ldem_4_apollo17_cutout.bin`. Its bytes are concatenated original row
segments, not a fabricated raster. The preparation script uses two separate binary
decoding paths (`array` and `struct`) and checks all source DNs and the demo pixel.

Coordinate-to-pixel calculation (zero-based):

```text
east_longitude = longitude % 360
source_row = floor((90 - latitude) * 4)
source_column = floor(east_longitude * 4)
subset_row = source_row - 248
subset_column = source_column - 96
byte_offset = 2 * (subset_row * 64 + subset_column)
used_latitude = 90 - (source_row + 0.5) / 4
used_longitude = (source_column + 0.5) / 4
```

This uses the exact native angular grid from the label, not rounded metre spacing.
Inputs must already be in the declared lunar frame; no terrestrial or lunar frame
transformation is performed. Grid-center coordinates are reported separately from
the requested coordinate. The coordinate round trip is center → row/column → center.

Verified demo: `(20.19, 30.77)` selects source row 279, column 123, subset row 31,
column 27. The center is `(20.125, 30.875)`; mapping it back returns `(279,123)` exactly.
The original source bytes and subset both contain DN **−5324**, so elevation is
**−2662.0 m**. This is the containing cell's value, not a precise measurement at the
requested point. Full HTTP response: `backend/data/metadata/terrain_sample_response.json`.

Original IMG SHA-256: `c04632eba6449af49e3108ed7c25b3b1c450600abd3690df4fc815853a1af476`.
Subset SHA-256: `02384ab144d5f90221040d5fd8e7d05b84820e8dd85e7ae6f424ef272a1b30cd`.
These hashes were computed from HTTPS downloads locally, not independently supplied
by NASA. Repeat acquisition refuses changed source hashes. Runtime verifies the
stored subset and label hashes before reading a value.

**Known discrepancy:** observed full-grid minimum is −17757 DN versus label −17758;
maximum agrees at 21008. The unexplained one-DN difference (0.5 m after scaling) is
recorded without altering values. The validity check requires every DN to lie within
the label range, not exact equality of the minimum. No declared nodata sentinel means
missing data cannot be conclusively excluded by a sentinel check alone.

Validation status is `ingestion-verified-not-scientifically-validated`: byte decoding,
source-to-subset agreement, coordinates, bounds, and integrity were checked. This
does not validate vertical accuracy or certify scientific/operational suitability.
The coarse grid cannot resolve landing-site hazards; labels also warn of possible
45° latitude-band artifacts. No profile, slope, horizon, heatmap, SPICE geometry,
landing ellipse, sensitivity analysis, or feasibility calculation is implemented.

Reproduce from the repository root in PowerShell:

```powershell
.\backend\.venv\Scripts\python.exe backend\scripts\prepare_lola_sample.py
.\backend\.venv\Scripts\python.exe backend\scripts\verify_backend.py --http
.\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
# In another terminal:
Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/terrain/sample?latitude=20.19&longitude=30.77'
```

The endpoint never downloads data. Missing, corrupt, unsupported, or unreadable data
returns HTTP 503 with a clear error; outside coverage or invalid coordinates returns
422. It never substitutes mock values. The mock analysis service remains independent.

## Verification

Type-check the architecture contracts using the existing frontend compiler:
`frontend/node_modules/.bin/tsc -p backend/tsconfig.json` (use `tsc.cmd` on Windows).
Build the existing frontend from `frontend` with `npm run build` (`npm.cmd` on Windows).
Frontend source/configuration hashes must remain identical for this architecture-only change.

For the Python foundation, run `backend/scripts/verify_backend.py` using the backend
virtual environment. It verifies imports, the mock API contracts, validation, CORS,
and source acknowledgements without NASA access. It also tests real sample provenance,
scaling, coordinate boundaries, and missing/corrupt-data failures. `--http` starts
Uvicorn, calls the health and sample routes, saves the actual sample response, then
stops the server. See the backend README for setup.
