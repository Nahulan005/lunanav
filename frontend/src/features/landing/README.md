# LunaNav – Lunar Landing Visualization Feature

A self-contained, illustrative lunar landing visualization component for the **LunaNav** NASA Space Apps Challenge mission planning dashboard.

This feature visualizes a lunar lander's terminal descent toward **Shackleton Rim** at the lunar south pole, complete with realistic-looking CSS crater details, terrain ridges, celestial direction indicators, an animated thruster plume, and a NASA mission-control telemetry dashboard.

---

> [!IMPORTANT]
> **Illustrative visualization. This is not a flight-dynamics simulation.**
> This feature is an illustrative user-experience and mission-concept demonstration. No real spacecraft navigation, orbital mechanics, guidance navigation and control (GNC), or physical landing flight dynamics are computed.

---

## 📁 File Structure & Restrictions

All code for this feature is strictly self-contained within `frontend/src/features/landing/`:

| File | Purpose |
| :--- | :--- |
| `LandingVisualization.tsx` | Main React component handling the landing animation loop, state machine, celestial indicators, craft positioning, and mission control telemetry HUD. |
| `LandingVisualization.css` | Premium NASA mission-control dark mode styling, pure CSS space starfield, Shackleton Rim mountain ridges, realistic CSS craters, thruster particle effects, and responsive layout. |
| `landingMockData.ts` | Centralized mock telemetry dataset containing exact coordinates, site metadata, descent parameters, crater positions, and celestial indicators. |
| `README.md` | Feature documentation, architecture guide, and beginner-friendly reference. |

---

## 🚀 Key Features

### 1. Visual Design & Atmosphere
- **NASA Mission-Control Aesthetic:** Deep navy and pure black space background (`#02050c` to `#08162b`) with subtle nebular glow and multi-tier twinkling starfield.
- **Lunar South Pole Terrain:** Multi-layered CSS ridges depicting the rugged relief of Shackleton Crater rim, including the sunlit peaks of eternal light and deep shadows.
- **Realistic CSS Craters:** Custom multi-stop radial and inner box-shadows simulating realistic sunward rim illumination and permanently shadowed crater floors.
- **Celestial Indicators:** Real-time HUD badges indicating line-of-sight direction to Earth (Direct-to-Earth communications link) and the Sun (low-angle grazing polar sunlight).
- **Glowing Landing Target Marker:** Concentric pulsing radar rings, vertical beacon beam, crosshair, and coordinate tag anchored at Shackleton Rim LZ-1 (`-89.9° Lat, 0.0° Long`).
- **Detailed Lunar Lander Illustration:** Pure SVG craft featuring a faceted crew ascent cabin, gold multi-layer insulation (MLI) foil texture, RCS thrusters, radar altimeter mast, shock-absorbing landing struts with footpads, and an animated thruster exhaust plume that pulses during descent and cuts off at touchdown.

### 2. State-Driven Animation Engine
Built with React standard hooks (`useState`, `useEffect`, `useRef`, `useCallback`) using `requestAnimationFrame`:
- **Start Landing:** Initiates smooth powered descent from high altitude down to surface touchdown.
- **Pause:** Freezes descent progress, altitude, velocity, and time in place.
- **Resume:** Pressing "Resume Descent" picks up seamlessly from the exact paused progress without time jumping.
- **Reset:** Returns the craft to its initial altitude (`1200 m`), resets elapsed time, and re-arms the descent sequence.
- **Automatic Touchdown Stop:** Safely halts the animation loop at 100% progress (`0 m` altitude), confirms touchdown, and disables the thruster flame.
- **Loop Protection:** Verifies and cancels any running `requestAnimationFrame` before scheduling another, strictly preventing multiple concurrent animation loops or memory leaks.

### 3. Telemetry Stream
Displays all required mission control telemetry values:
- **Selected site:** `Shackleton Rim`
- **Latitude:** `-89.9°`
- **Longitude:** `0.0°`
- **Status:** `Illustrative demo`
- **Terrain source:** `Planned LOLA integration`
- **Radar Altitude (Mock):** Live illustrative meter readout with dynamic progress bar.
- **Vertical Velocity (Mock):** Illustrative deceleration profile (e.g. from `-35 m/s` braking phase down to `-1.2 m/s` final touchdown).
- **Descent Phase:** Dynamic phase labels (`Approach Phase`, `Powered Descent`, `Terminal Guidance`, `Touchdown Confirmed`).

---

## 💻 Quickstart & Usage

To mount the visualization in any part of the LunaNav application or test sandbox:

```tsx
import React from 'react';
import { LandingVisualization } from './features/landing/LandingVisualization';

export const LandingPage: React.FC = () => {
  return (
    <div style={{ minHeight: '100vh', background: '#02050c' }}>
      <LandingVisualization />
    </div>
  );
};

export default LandingPage;
```

---

## 🧩 Architecture Details for Beginners

### 1. `requestAnimationFrame` vs `setInterval`
In `LandingVisualization.tsx`, we utilize the browser's native `requestAnimationFrame` rather than `setInterval`.
- `requestAnimationFrame` synchronizes updates directly with the user's monitor refresh rate (typically 60Hz or 120Hz), ensuring buttery smooth motion.
- When the user switches tabs, `requestAnimationFrame` pauses automatically, preserving CPU and battery resources.
- `animationFrameRef` stores the numeric handle returned by `requestAnimationFrame`, allowing safe cleanup via `cancelAnimationFrame` upon unmount or pause.

### 2. Managing Time Deltas
Instead of incrementing fixed steps per frame, the component measures `deltaTime = timestamp - lastTimestamp`. This ensures that even if frame rates fluctuate, the descent duration remains consistent across devices.

### 3. Realistic CSS Craters Without External Assets
Polar craters are illuminated from extreme grazing angles. In `LandingVisualization.css`, this is modeled purely using CSS:
- Elliptical dimensions simulating oblique viewing angle (`height: size * 0.42`).
- Asymmetric radial gradient creating the shadowed interior.
- Sunward crescent highlight (`rgba(184, 218, 250, 0.5)`) on the rim.

---

## 🗺️ Future Roadmap: Planned LOLA Integration
Currently, the terrain is rendered with high-fidelity illustrative CSS formations. The production roadmap includes:
- Connecting to NASA Lunar Reconnaissance Orbiter (LRO) **Lunar Orbiter Laser Altimeter (LOLA)** elevation geotiffs.
- Translating LOLA digital elevation models (DEM) into precise local slope, surface roughness, and hazard avoidance maps for Shackleton Rim.
