# LunaNav frontend

A responsive React + TypeScript + Vite mission-planning dashboard using lucide-react and plain CSS. All data is fictional and illustrative, not scientifically accurate or suitable for operational mission planning.

## Run locally

From this directory:

```sh
npm install
npm run dev
npm run build
```

On Windows with PowerShell script execution disabled, use `npm.cmd` in place of `npm`.

## Structure

- `src/App.tsx`: mission configuration, loading state, analyzed-result snapshot, and scenario comparison.
- `src/components/`: reusable lunar map, metric card, and timeline.
- Mission-control header, selected-site readout, and scenario assessment components extend the dashboard; Schedule Analyzer and 3D Landing are explicitly marked as planned navigation items.
- `src/data/mockData.ts`: all preset sites, sample estimates, timeline periods, and initial configuration.
- `src/services/analysis.ts`: typed demo analysis adapter and future endpoint constant.
- `src/index.css`: all application styles, responsive layouts, and reduced-motion support.

## Demo behavior

Select a preset from the dropdown, map marker, or comparison row. Editing coordinates switches to Custom Location. Coordinate limits and required fields use native form validation. Analyze Mission delays locally for 1.2 seconds and returns fixed fixtures; configuration controls are disabled during loading. Existing results retain the last analyzed site and date until the next analysis completes.

Dates and custom coordinates do not generate scientific estimates. Timeline periods are a shared illustrative fixture and do not derive from metric percentages. The map is a CSS schematic, not a geographic projection.

The reference-inspired workstation styling uses CSS terrain shading, decorative craters, curved coordinate lines, orbital rings, and a technical target tooltip. Scenario status badges and the failure explanation use editorial fixtures in `src/data/mockData.ts`. They do not represent calculated feasibility or scientific failure conditions. Existing metric fixtures and the typed analysis adapter are preserved.

## Future backend integration

The intended endpoint is `POST /api/v1/analysis`. `AnalysisRequest` currently describes site ID, latitude, longitude, and landing date. Replace `analyzeMissionDemo` with a real client only after establishing the backend request and response contracts, including validation, errors, timeouts, and cancellation. The current UI makes no API requests and includes no backend or API keys.
