/**
 * Generates a smooth random surface using Perlin-like noise
 */
export function generateSurface(width: number, height: number, _seed: number): number[][] {
  const surface: number[][] = [];

  // Generate surface with multiple octaves of noise
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      let value = 0;
      let amplitude = 1;
      let frequency = 0.05;
      let maxValue = 0;

      // Multiple octaves for more realistic surface
      for (let i = 0; i < 4; i++) {
        value += amplitude * perlinNoise(x * frequency, y * frequency);
        maxValue += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
      }

      row.push(value / maxValue);
    }
    surface.push(row);
  }

  // Normalize to 0-100 range
  return normalizeSurface(surface);
}

/**
 * Simple Perlin-like noise function
 */
function perlinNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  // Get pseudo-random values for corners
  const n00 = pseudoRandom(xi, yi);
  const n10 = pseudoRandom(xi + 1, yi);
  const n01 = pseudoRandom(xi, yi + 1);
  const n11 = pseudoRandom(xi + 1, yi + 1);

  // Interpolation
  const u = fade(xf);
  const v = fade(yf);

  const nx0 = lerp(n00, n10, u);
  const nx1 = lerp(n01, n11, u);
  const result = lerp(nx0, nx1, v);

  return result;
}

/**
 * Pseudo-random value based on coordinates
 */
function pseudoRandom(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Fade function (smooth step)
 */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Linear interpolation
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Normalize surface values to 0-100
 */
function normalizeSurface(surface: number[][]): number[][] {
  let min = Infinity;
  let max = -Infinity;

  for (const row of surface) {
    for (const value of row) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  const range = max - min;

  return surface.map(row =>
    row.map(value => ((value - min) / range) * 100)
  );
}
