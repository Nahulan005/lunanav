# LunaNav scientific systems architecture

## Current implementation and status

The React/TypeScript/Vite frontend connects to the FastAPI backend when configured.
`POST /api/v1/analysis` remains mock and Compare Scenarios uses fixed fixtures.
Separate endpoints provide local-derived LDEM_4 elevation sample/profile context,
provisional Site04 observation counts in native X/Y, and network-derived Horizons
Sun/Earth directions when the provider returns an available response. Real risk,
terrain-aware illumination/visibility windows, and recommendations are not evaluated.
The coloured Moon patches and Landing Demo are explicit presentation fixtures.

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
- [LRO/LOLA](https://science.nasa.gov/mission/lro/lola/): local bounded elevation and observation-count source; further terrain analysis planned.
- [LROC through LRO Data Products](https://science.nasa.gov/mission/lro/data-products/): prospective image context.
- [NAIF/SPICE](https://naif.jpl.nasa.gov/naif/): prospective local geometry toolkit and kernels.
- [Celestial Mapping System](https://celestialmappingsystem.arc.nasa.gov): mapping, profile, visibility, and planning workflow reference.

The registry distinguishes implemented local LOLA subsets from references and
future integrations. JPL Horizons is the configured live network geometry provider;
NAIF/SPICE is not its implementation and remains planned. Local data and Horizons
responses do not establish NASA endorsement or scientific validation. No SPICE
kernels are bundled. Site04 geographic overlay remains blocked pending verified
registration; see the backend Site04 handoff for its exact native metadata.

## Free-first deployment

Start with one local workstation, an offline preprocessing command, files on disk,
and a small local service when the first scientific provider is ready. Proposed
scientific runtime: Python with Rasterio/GDAL, NumPy, and SpiceyPy. These are optional
future-runtime dependencies in `backend/requirements-science.txt`; the mock API needs
only `backend/requirements.txt`. Rasterio is offline preprocessing tooling for
Site04, not an API runtime import. The API serves a pinned derived artifact; no
SPICE kernels or terrain-aware visibility calculations are configured.
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
| TerrainProvider | Python MockTerrainProvider: fixed illustrative elevation/slope/horizon fixture | Local LOLA raster sampling, slope and horizon processing |
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

## Smallest real NASA-data hackathon milestone

Manually acquire **one documented LOLA elevation product covering one selected site**.
Keep the source label and checksum; establish its projection, frame, vertical datum,
coverage, and native pixel spacing from metadata. Produce one reproducible local
elevation sample and short terrain profile, including nodata handling and a provenance
manifest. Check sampled values against the source raster and document a coordinate
round-trip check. This is a measurable real-data result without SPICE, networking,
or a mission-feasibility claim. If suitable coverage or metadata is missing, choose
another documented product rather than guessing.

Next milestones: local slope/horizon → pinned SPICE geometry → derived geometric
visibility → requirement evaluation → explicit frontend integration. LROC context can
be added independently. Moon Trek/CMS support discovery and manual workflow comparison.
Product IDs, resolutions, kernels, download methods, and hosting are intentionally
unselected until inspected; these are future integrations, not current features.

## Verification

Type-check the architecture contracts using the existing frontend compiler:
`frontend/node_modules/.bin/tsc -p backend/tsconfig.json` (use `tsc.cmd` on Windows).
Build the existing frontend from `frontend` with `npm run build` (`npm.cmd` on Windows).
Frontend source/configuration hashes must remain identical for this architecture-only change.

For the Python foundation, run `backend/scripts/verify_backend.py` using the backend
virtual environment. It verifies imports, the mock API contracts, validation, CORS,
and source acknowledgements without NASA access. See the backend README for setup.
