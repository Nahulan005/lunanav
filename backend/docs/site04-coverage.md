# Site04 observation-coverage handoff

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
