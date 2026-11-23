# 🌕 LunaNav
### A lunar landing-site explorer for the Moon’s south pole

[![Live demo](https://img.shields.io/badge/🚀_Live_Demo-LunaNav-00a9c4?style=for-the-badge)](https://lunanav.vercel.app/)
[![Verify](https://github.com/Nahulan005/lunanav/actions/workflows/verify.yml/badge.svg?branch=main)](https://github.com/Nahulan005/lunanav/actions/workflows/verify.yml)

LunaNav is a hackathon prototype for exploring how **location, date, and terrain** shape lunar landing-site planning. Near the south pole, the Sun can sit close to the horizon, where a ridge can change which areas receive light. LunaNav brings terrain and Sun–Earth geometry into one workspace so you can see what information is available for a candidate site.

## 🧭 What you can do

- **Choose a site and UTC date.** Pick a preset on the lunar map or enter coordinates.
- **Explore Sun and Earth geometry.** Inspect azimuth and elevation from JPL Horizons, then scrub through the returned samples in Schedule Manager.
- **Inspect Site04 in 3D.** View the footprint and explore the bundled **32 × 32 patch at 5 m spacing**, with elevation, slope, uncertainty, and laser return counts.
- **Try example missions.** Compare preset scenarios, watch a descent, or explore a scripted diversion.

**Start here** · [Lunar Map](https://lunanav.vercel.app/#/map) · [Site Analysis](https://lunanav.vercel.app/#/analysis) · [Site04 in 3D](https://lunanav.vercel.app/#/landing-3d/site04)

## 🔬 Where the data comes from

| Source | What it provides |
| --- | --- |
| [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) | Modelled Sun and Earth directions relative to a smooth lunar horizon. |
| [NASA PDS · LOLA LDEM_4](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_4.lbl) | Coarse point elevation within the bundled Apollo 17 cutout. |
| [NASA GSFC · South Pole LOLA DEMs](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/) | Higher resolution Site04 terrain and observation coverage. Custom patches require the full raster set on the backend. |

**How to read the results.** Site04 terrain and placement are provisional. A zero laser return count can still accompany an interpolated elevation. The global Moon surface, scenario scores, and flight animations are illustrative. Landing safety, terrain-cleared sunlight windows, and radio link availability remain unevaluated.

## 🛠️ Stack and setup

**React · TypeScript · Vite · Three.js · Python · FastAPI**

Run the [FastAPI backend](backend/README.md) first, then start the [web app](frontend/README.md) with `VITE_API_BASE_URL` pointing to your backend. Use Python 3.11+ and Node.js 22.12+. Live geometry requires internet access to JPL Horizons.

[Demo guide](docs/DEMO_GUIDE.md) · [Site04 data and coordinates](backend/docs/site04-spatial-access.md) · [Render deployment](backend/docs/site04-render-deployment.md)

## 🤝 Contributing

Open a PR with a short summary and verification steps. For data changes, include the source, units, coordinate frame, and coverage limits.

_LunaNav is an independent hackathon project using public NASA and JPL data._
