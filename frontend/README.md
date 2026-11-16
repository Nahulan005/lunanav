# LunaNav frontend

React + TypeScript + Vite mission-planning workspace. Demo comparisons and coloured
Moon patches are illustrative; real provider responses are identified separately.
No landing-safety assessment or overall risk score is calculated.

## Configure and run

Copy the settings below into frontend/.env.local, using the actual backend origin:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
```

For Vercel, set VITE_API_BASE_URL to the deployed backend HTTPS origin and rebuild.
The backend CORS_ORIGINS must include the frontend origin. No API keys are needed.
Without this setting, health/analysis/terrain/coverage use the existing local
127.0.0.1:8000 default; Horizons geometry requests remain disabled.

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run build
```

## Pages and data

Hash routes replace the main page: #/overview, #/map, #/analysis, #/schedule,
#/coverage, #/compare, #/landing-3d and #/landing-demo. Dashboard site/date/scenario
state persists between views. Moon3D receives the selected coordinates on entry.

- POST /api/v1/analysis is explicitly mock. Compare Scenarios uses fixed fixtures.
- LOLA sample/profile endpoints provide bounded local-derived elevation context.
- JPL Horizons supplies model-derived point-in-time Sun/Earth directions when
  configured and available. This is not terrain-cleared visibility or a schedule.
- Site04 coverage supplies a provisional native 32x32 observation-count window in
  projected X/Y metres, displayed separately on the 3D page. No verified lat/lon
  overlay exists. Counts are not terrain, risk or suitability.
- Landing Demo and the toggleable coloured risk patches are illustrative fixtures.

Health, terrain and Site04 GET requests have a 15-second bound, including JSON
reading. Health and coverage provide visible retry controls and error status;
geometry uses its separate bounded request and retry. No automatic retry loop or
synthetic coverage fallback is used. Production build includes TypeScript checking.


## Adaptive scenario demo and schedule context

`#/adaptive-simulation` is a separate first-person scenario trainer. It has a
scripted warning after two seconds of active playback, demo map, destination
confirmation, pause/reset controls, course-change animation and explicit scripted
success/failure endings. Only the fictional Alternate Alpha route is configured
to succeed. This is not AI inference, flight dynamics or a safe-arrival prediction;
it makes no backend requests and sends no spacecraft commands. Existing Landing
Demo remains separate. Planning site/date are context only, not terrain inputs.

Mission Schedule requests geometry directly when configured. Its plot and sample
scrubber use only returned Horizons observations; no interpolation, invented gaps,
terrain-aware schedule windows or communications forecasts are generated.


## Moon visual renderer

The 3D Moon uses Three.js, React Three Fiber and Drei's orthographic camera.
The scene is loaded on demand; it uses locally generated decorative crater and
maria texture, bump shading and studio lighting, not NASA imagery/elevation or
calculated solar illumination. Its orthographic scale and rotation follow the
existing screen projection so marker/grid selection stays aligned. Renderer
failure or WebGL context loss restores the previous Canvas 2D fallback. No
backend contract, provider values, coverage placement or demo fixture scores
are changed. The larger graphics bundle is separate from the dashboard bundle.
