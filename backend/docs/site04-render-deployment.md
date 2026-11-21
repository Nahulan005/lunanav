# Site04 regional reader on Render Free

## Recover the existing service

The Vercel frontend calls `https://lunara-cqiq.onrender.com`. When debugging a
deployment mismatch, check that origin directly. A healthy
`/api/v1/health` only confirms the service responds. A 404 from
`/api/v1/terrain/site04/grid` or `/api/v1/terrain/site04/footprint`, or the
original “ingestion is not enabled” coverage response, indicates that the
deployed API does not have the current Site04 implementation.

In the existing Render service, verify the repository, deploy branch (`main`)
and root directory (`backend`). Deploy the current reviewed commit. The ordinary
`pip install -r requirements.txt` build is enough to serve both prepared centre
patches and the footprint without external TIFFs. Verify these three endpoints
before changing any frontend environment setting:

| GET path | Expected response |
| --- | --- |
| `/api/v1/terrain/site04/grid` | HTTP 200, provisional, 1,024 elevation/slope cells |
| `/api/v1/terrain/site04/footprint` | HTTP 200, Site04 source extent and centre |
| `/api/v1/terrain/site04/coverage` | HTTP 200, provisional, 1,024 cells, 88 observed |

Once the prepared patch works, enable arbitrary regional queries if needed. The
regional reader needs all five pinned TIFFs and GIS dependencies. The prepared
centre patch uses a separate request and remains available without this setup.

## Optional regional queries

Build Command:

```sh
pip install -r requirements-terrain.txt && python scripts/provision_site04.py data/site04_external && python scripts/provision_site04.py data/site04_external --verify-only
```

Environment variable:

```text
SITE04_DATA_DIR=/opt/render/project/src/backend/data/site04_external
```

The path is the standard Render native build checkout layout with backend root.
Confirm it against actual build logs before deployment. Alternatively, use
`SITE04_DATA_DIR=data/site04_external` when the service starts from the configured
backend root (as Render normally does).

Expected Start Command (compare with current setting; preserve any existing
customization):

```sh
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Keep existing CORS/provider environment settings. Use a Python version compatible
with Rasterio wheels and hashlib.file_digest (Python 3.11+); the actual deployment
must confirm dependency availability and build disk/memory limits. No GIS packages
were installed as part of this local change. The optional requirement file is
separate so existing lightweight deployments continue to work.

## Files and failure handling

The provisioner retrieves only the five documented official Site04 TIFF URLs,
streaming at most each pinned product's exact byte length. It verifies SHA-256
and size before atomic replacement, cleans partial downloads and fails the build
on mismatch or timeout (20-second socket timeout, 300-second total transfer budget).
Already intact files are reused. No raw files enter Git; about 205 MB must fit in
the build image. NASA availability and Render's build/network limits still need
verification in a real deployment; local integrity checks do not prove remote
build success.

Render Free has no persistent disks and loses runtime filesystem changes on
restart/spindown. Therefore provision during build and package the data with the
build artifact, rather than uploading/downloading once after launch. If Render
does not retain that build directory in its runtime artifact, stop deployment
and choose explicit image packaging or object storage; do not return fixtures.
Each deployment repeats provisioning as needed. Free service cold starts may
exceed the frontend request timeout; retry remains user initiated.

Official guidance: https://render.com/docs/free and
https://render.com/docs/deploys .

## Acceptance after deployment

1. Confirm build logs show all five VERIFIED products and compatible GIS imports.
2. Confirm the normal health, analysis, geometry and fixed terrain routes remain
   usable. Health is capability metadata, not NASA service uptime.
3. Request `/api/v1/terrain/site04/grid?latitude=-89.7668&longitude=-171.87&width=32`:
   HTTP 200, provisional, 1024 real cells with sources/units/selection/mapping.
4. Request the same route at latitude 20.19, longitude 30.77: HTTP 422,
   `OUTSIDE_SITE04_COVERAGE` (not clamping or demo data).
5. Repeat a query after a cold start; verify sources are still present.
6. Build the frontend with the deployed API origin in `VITE_API_BASE_URL`. Open
   `#/landing-3d/site04` for the prepared centre patch. Switch to Site04 footprint
   and select a location to request a regional patch.

Do not merge or change production until the owner has reviewed this branch and
the current Start Command/environment path are confirmed.

## Local verification performed

- All five existing TIFF sizes and SHA-256 values pass provisioner --verify-only.
- Mocked download success, checksum rejection and partial-file cleanup pass,
  without a new NASA download. The actual Render build/download is not tested.
- Backend verification, regional-window checks, fixed terrain checks and mocked
  geometry verification pass. Frontend TypeScript/production build passes with
  the existing large MoonScene chunk warning.
- Bounded local browser run against the real TIFF-backed API confirms 1024 real
  elevation cells on the WebGL view, regional/whole-Moon switching, provisional
  labels, coverage-explorer values and cell selection, browser Back and a
  390-pixel mobile coverage layout without horizontal overflow. Local servers
  and the browser are stopped automatically. No production verification claimed.

Files edited during the globe/deployment step (earlier uncommitted backend and
explorer work is preserved):

- backend/.gitignore
- backend/README.md
- backend/docs/site04-spatial-access.md
- backend/docs/site04-render-deployment.md (new)
- backend/scripts/provision_site04.py (new)
- backend/scripts/verify_site04_windows.py
- frontend/src/services/site04Terrain.ts
- frontend/src/features/moon3d/Moon3DView.tsx
- frontend/src/features/moon3d/MoonScene.tsx
- frontend/src/features/moon3d/Site04SurfaceLayer.tsx (new)

The follow-up true-relief view adds
`frontend/src/features/moon3d/Site04TerrainScene.tsx`, `site04Mesh.ts` and
`site04TerrainScene.css`, plus a small Moon3DView integration update. No backend
formulas or contracts changed for this follow-up. A direct mesh check verifies
1024 source vertices, 1922 triangles, unchanged heights, orientation, and removal
of eight triangles around one missing interior sample. Whole-Moon colour draping
and regional true-height mesh are different views and are labelled accordingly.
