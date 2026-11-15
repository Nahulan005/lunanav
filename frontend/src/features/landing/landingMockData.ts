/**
 * LunaNav - Lunar Landing Visualization Mock Data
 * Shackleton Rim Mission Control Telemetry & Terrain Data
 *
 * NOTE: Illustrative visualization. This is not a flight-dynamics simulation.
 * No real spacecraft navigation or orbital mechanics are computed here.
 */

export const landingMockData = {
  siteName: "Shackleton Rim",

  coordinates: {
    latitude: -89.9,
    longitude: 0.0,
  },

  status: "Illustrative demo",

  terrainSource: "Planned LOLA integration",

  disclaimer:
    "Illustrative visualization. This is not a flight-dynamics simulation.",

  descent: {
    initialAltitude: 1200,
    targetAltitude: 0,
// illustrative starting altitude in meters
// touchdown altitude in meters
    initialProgress: 0,
    descentDuration: 30000,
 // duration of the illustrative descent animation in ms
    nominalDescentSpeed: -24.5, // illustrative vertical speed in m/s
  },

  environment: {
    earthDirection: "Earth visibility indicator",
    sunDirection: "Sun direction indicator",
    earthBearing: "014° Az / 1.4° Elev",
    earthStatus: "Continuous direct-to-Earth link available",
    sunBearing: "278° Az / 1.2° Elev",
    sunStatus: "Low-incidence polar illumination on rim",
  },

  terrain: {
    craters: [
      { x: 15, size: 35 },
      { x: 42, size: 55 },
      { x: 72, size: 42 },
      { x: 88, size: 25 },
      { id: "c1", x: 12, y: 78, size: 48, depth: "deep", name: "Faustini Outlier" },
      { id: "c2", x: 32, y: 84, size: 68, depth: "medium", name: "Connecting Ridge Crater" },
      { id: "c3", x: 50, y: 88, size: 34, depth: "shallow", name: "Shackleton LZ Craterlet" },
      { id: "c4", x: 68, y: 82, size: 54, depth: "deep", name: "Shoemaker Secondary" },
      { id: "c5", x: 86, y: 86, size: 40, depth: "medium", name: "Haworth Ejecta Pit" },
    ],

    target: {
      x: 50,
      label: "SELECTED LANDING TARGET",
      subLabel: "SHACKLETON RIM LZ-1",
      coordinatesText: "89.9° S, 0.0° E",
    },

    lolaElevationProfile: "South Pole Peak of Eternal Light (Ridge ~1,250 m relative relief)",
  },

  telemetrySteps: [
    { threshold: 0, phase: "Braking Phase Initiation", rate: "-35.0 m/s" },
    { threshold: 30, phase: "Powered Descent / Pitch-Up", rate: "-22.5 m/s" },
    { threshold: 65, phase: "Approach & Hazard Avoidance", rate: "-12.0 m/s" },
    { threshold: 85, phase: "Terminal Guidance & Gate", rate: "-4.5 m/s" },
    { threshold: 96, phase: "Final Vertical Touchdown", rate: "-1.2 m/s" },
    { threshold: 100, phase: "Touchdown Confirmed", rate: "0.0 m/s" },
  ],
};

export type LandingMockData = typeof landingMockData;
