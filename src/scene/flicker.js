// Candle flicker: layered sines, out of step per flame (seed), in about -1..1.
export const flicker = (t, seed) =>
  Math.sin(t * 7.3 + seed) * 0.5 + Math.sin(t * 13.1 + seed * 2.1) * 0.3 + Math.sin(t * 23.7 + seed * 3.7) * 0.2
