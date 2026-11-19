# LunaNav — Technical Status

## 1. Project Overview

LunaNav is a lunar landing-site decision-support prototype developed for NASA's Lunar Landing Site Navigator challenge.

The project aims to help users compare lunar landing locations and dates using information related to sunlight, Earth visibility, terrain conditions, and mission requirements.

The current repository contains a React and TypeScript frontend prototype and a separate Python FastAPI backend foundation.

## 2. Technology Stack

### Frontend

- React 19
- TypeScript
- Vite
- Lucide React
- CSS

### Backend

- Python
- FastAPI
- Pydantic
- Uvicorn
- HTTPX
- Python-dotenv

### Development and Version Control

- Visual Studio Code
- Git
- GitHub
- PowerShell

## 3. Frontend Technical Status

### Implemented Components

The frontend contains the following major components:

- LunarMap
- MetricCard
- MissionHeader
- MissionTimeline
- ScenarioComparison
- SelectedSitePanel

### Implemented Features

- Interactive landing-site dashboard.
- Landing-site preset selection.
- Custom latitude and longitude inputs.
- Landing-date selection.
- Analyze Mission interaction.
- Mission indicator cards.
- Demonstration sunlight and Earth-visibility timeline.
- Multiple-scenario comparison.
- Predefined scenario assessment explanations.

### Frontend Data Processing

The frontend currently uses a local mock analysis adapter.

The displayed values and scenario assessments are illustrative fixtures.

The dashboard does not currently perform validated lunar illumination, terrain, or mission-feasibility calculations.

## 4. Backend Technical Status

The backend is built using FastAPI and provides a foundation for future scientific services.

### Implemented API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v1/health` | GET | Application health and mock-mode information |
| `/api/v1/analysis` | POST | Mock mission analysis |

### Backend Architecture

The backend uses provider interfaces for:

- TerrainProvider
- EphemerisProvider
- ImageryProvider
- VisibilityAnalysisProvider

The active providers currently use mock implementations.

### API Features

- Typed Pydantic request and response schemas.
- Input validation.
- Structured API responses.
- Provider provenance information.
- NASA source references.
- OpenAPI documentation.
- Backend verification script.

### Important Limitation

The backend is not currently connected to the React frontend.

The API's mock analysis does not perform scientific lunar calculations.

## 5. NASA Data Sources and Scientific Resources

The project references the following NASA resources for future development:

### NASA LRO / LOLA

Purpose:

- Lunar elevation data.
- Terrain analysis.
- Future slope and horizon calculations.

### NASA NAIF / SPICE

Purpose:

- Future Sun and Earth position calculations.
- Ephemeris and geometry analysis.
- Time-dependent visibility calculations.

### NASA Moon Trek

Purpose:

- Lunar surface exploration.
- Site discovery and visual reference.

### NASA LROC Data Products

Purpose:

- Lunar imagery.
- Surface context and geological reference.

### NASA Celestial Mapping System

Purpose:

- Terrain and visibility planning reference.

**Current status:** These resources are documented in the source registry. Their presence in the registry does not indicate that live integrations or scientific calculations are implemented.

## 6. Current Implementation Classification

### Working

- React and TypeScript dashboard.
- Landing-site selection.
- Coordinate and landing-date inputs.
- Local mock analysis workflow.
- Mission indicator cards.
- Demonstration timeline.
- Scenario comparison interface.
- FastAPI application foundation.
- API health endpoint.
- Mock analysis endpoint.
- Backend request validation.
- Backend verification script.

### Mock or Illustrative

- Sunlight availability.
- Earth visibility.
- Terrain obstruction.
- Mission feasibility.
- Mission timeline segments.
- Scenario assessment labels and explanations.
- Decorative lunar crater geometry.
- Backend terrain, ephemeris, imagery, and visibility provider results.

### Planned

- Live NASA data integration.
- SPICE-based Sun and Earth geometry.
- Full LOLA terrain processing.
- Terrain-derived slope calculations.
- Terrain-aware horizon analysis.
- Scientifically validated visibility predictions.
- Requirement-driven landing-site assessment.
- Landing-ellipse robustness analysis.
- Schedule-slip tolerance analysis.
- Frontend-to-backend integration.
- Evidence-based mission assessment explanations.

## 7. Verification and Testing

### Frontend Build Verification

Run from the `frontend` directory:

```powershell
npm install
npm run build