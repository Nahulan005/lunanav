/** Screen layout and phase markers for the illustrative descent. */
export const landingMockData = {
  status: 'Illustrative demo',
  descent: { initialAltitude: 1200 },
  terrain: {
    craters: [
      { id: 'c1', x: 12, y: 78, size: 48, depth: 'deep' },
      { id: 'c2', x: 32, y: 84, size: 68, depth: 'medium' },
      { id: 'c3', x: 50, y: 88, size: 34, depth: 'shallow' },
      { id: 'c4', x: 68, y: 82, size: 54, depth: 'deep' },
      { id: 'c5', x: 86, y: 86, size: 40, depth: 'medium' },
    ],
    target: { label: 'DEMO TARGET' },
  },
  telemetrySteps: [
    { threshold: 0, phase: 'Braking starts' },
    { threshold: 30, phase: 'Powered descent' },
    { threshold: 65, phase: 'Approach' },
    { threshold: 85, phase: 'Terminal gate' },
    { threshold: 96, phase: 'Final descent' },
    { threshold: 100, phase: 'Touchdown' },
  ],
}
