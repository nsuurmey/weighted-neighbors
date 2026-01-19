/**
 * Kriging module for interpolation and semivariogram calculations
 */

export interface Sample {
  x: number;
  y: number;
  z: number;
}

export interface VariogramParams {
  nugget: number;
  sill: number;
  range: number;
}

/**
 * Spherical variogram model
 */
export function sphericalVariogram(distance: number, params: VariogramParams): number {
  const { nugget, sill, range } = params;
  const c = sill - nugget;

  if (distance === 0) return 0;
  if (distance >= range) return sill;

  const h_a = distance / range;
  return nugget + c * (1.5 * h_a - 0.5 * Math.pow(h_a, 3));
}

/**
 * Calculate empirical semivariogram from samples
 */
export function calculateSemivariogram(
  samples: Sample[],
  binSize: number = 5
): { distance: number; semivariance: number }[] {
  if (samples.length < 2) return [];

  const pairs: { distance: number; semivariance: number }[] = [];

  // Calculate all pairwise distances and semivariances
  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      const dx = samples[i].x - samples[j].x;
      const dy = samples[i].y - samples[j].y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const semivariance = 0.5 * Math.pow(samples[i].z - samples[j].z, 2);

      pairs.push({ distance, semivariance });
    }
  }

  // Bin the data
  if (pairs.length === 0) return [];

  const maxDistance = Math.max(...pairs.map(p => p.distance));
  const bins: { distance: number; count: number; sum: number }[] = [];

  for (let i = 0; i <= Math.ceil(maxDistance / binSize); i++) {
    bins.push({ distance: (i + 0.5) * binSize, count: 0, sum: 0 });
  }

  // Assign pairs to bins
  for (const pair of pairs) {
    const binIndex = Math.floor(pair.distance / binSize);
    if (binIndex < bins.length) {
      bins[binIndex].count++;
      bins[binIndex].sum += pair.semivariance;
    }
  }

  // Calculate average semivariance for each bin
  return bins
    .filter(bin => bin.count > 0)
    .map(bin => ({
      distance: bin.distance,
      semivariance: bin.sum / bin.count,
    }));
}

/**
 * Fit spherical model to empirical semivariogram (simplified)
 */
export function fitVariogramParams(
  empirical: { distance: number; semivariance: number }[]
): VariogramParams {
  if (empirical.length === 0) {
    return { nugget: 0, sill: 1, range: 10 };
  }

  // Simple fitting: use empirical data to estimate parameters
  const nugget = Math.min(...empirical.map(e => e.semivariance)) * 0.1;
  const sill = Math.max(...empirical.map(e => e.semivariance)) * 1.1;
  const maxDistance = Math.max(...empirical.map(e => e.distance));
  const range = maxDistance * 0.5;

  return { nugget, sill, range };
}

/**
 * Ordinary kriging prediction for a single point
 */
export function krigePoint(
  x: number,
  y: number,
  samples: Sample[],
  params: VariogramParams
): number {
  if (samples.length === 0) return 0;

  // Check if point is exactly at a sample location
  for (const sample of samples) {
    if (sample.x === x && sample.y === y) {
      return sample.z;
    }
  }

  // Build system matrix (simplified kriging)
  const n = samples.length;
  const A: number[][] = [];
  const b: number[] = [];

  // Distance matrix and right-hand side
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        row.push(0);
      } else {
        const dx = samples[i].x - samples[j].x;
        const dy = samples[i].y - samples[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        row.push(sphericalVariogram(distance, params));
      }
    }
    row.push(1); // Lagrange multiplier
    A.push(row);

    // Distance from point to sample i
    const dx = x - samples[i].x;
    const dy = y - samples[i].y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    b.push(sphericalVariogram(distance, params));
  }

  // Add constraint row for unbiased kriging
  const constraintRow = new Array(n).fill(1);
  constraintRow.push(0);
  A.push(constraintRow);
  b.push(1);

  // Solve using Gaussian elimination
  const weights = gaussianElimination(A, b);

  if (!weights) {
    // Fallback to inverse distance weighting
    return inverseDistanceWeighting(x, y, samples);
  }

  // Calculate kriged value
  let prediction = 0;
  for (let i = 0; i < n; i++) {
    prediction += weights[i] * samples[i].z;
  }

  return prediction;
}

/**
 * Simple Gaussian elimination solver
 */
function gaussianElimination(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const matrix = A.map(row => [...row]);
  const rhs = [...b];

  // Forward elimination
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(matrix[k][i]) > Math.abs(matrix[maxRow][i])) {
        maxRow = k;
      }
    }

    // Swap rows
    [matrix[i], matrix[maxRow]] = [matrix[maxRow], matrix[i]];
    [rhs[i], rhs[maxRow]] = [rhs[maxRow], rhs[i]];

    // Check for singular matrix
    if (Math.abs(matrix[i][i]) < 1e-10) {
      return null;
    }

    // Eliminate below
    for (let k = i + 1; k < n; k++) {
      const factor = matrix[k][i] / matrix[i][i];
      for (let j = i; j < n; j++) {
        matrix[k][j] -= factor * matrix[i][j];
      }
      rhs[k] -= factor * rhs[i];
    }
  }

  // Back substitution
  const solution = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    solution[i] = rhs[i];
    for (let j = i + 1; j < n; j++) {
      solution[i] -= matrix[i][j] * solution[j];
    }
    solution[i] /= matrix[i][i];
  }

  return solution;
}

/**
 * Inverse distance weighting (fallback)
 */
function inverseDistanceWeighting(x: number, y: number, samples: Sample[]): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const sample of samples) {
    const dx = x - sample.x;
    const dy = y - sample.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 0.001) return sample.z; // At sample location

    const weight = 1 / (distance * distance);
    weightedSum += weight * sample.z;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Predict entire surface using kriging
 */
export function kригingPrediction(
  width: number,
  height: number,
  samples: Sample[],
  params: VariogramParams,
  step: number = 1
): number[][] {
  const prediction: number[][] = [];

  for (let y = 0; y < height; y += step) {
    const row: number[] = [];
    for (let x = 0; x < width; x += step) {
      const value = krigePoint(x, y, samples, params);
      row.push(value);
    }
    prediction.push(row);
  }

  return prediction;
}

/**
 * Calculate RMSE between two surfaces
 */
export function calculateRMSE(true_surface: number[][], predicted_surface: number[][]): number {
  let sumSquaredError = 0;
  let count = 0;

  const minHeight = Math.min(true_surface.length, predicted_surface.length);
  const minWidth = Math.min(
    true_surface[0]?.length ?? 0,
    predicted_surface[0]?.length ?? 0
  );

  for (let y = 0; y < minHeight; y++) {
    for (let x = 0; x < minWidth; x++) {
      const error = true_surface[y][x] - predicted_surface[y][x];
      sumSquaredError += error * error;
      count++;
    }
  }

  return count > 0 ? Math.sqrt(sumSquaredError / count) : 0;
}

/**
 * Calculate standard deviation of surface
 */
export function calculateStdDev(surface: number[][]): number {
  let sum = 0;
  let sumSquared = 0;
  let count = 0;

  for (const row of surface) {
    for (const value of row) {
      sum += value;
      sumSquared += value * value;
      count++;
    }
  }

  const mean = sum / count;
  const variance = sumSquared / count - mean * mean;
  return Math.sqrt(Math.max(variance, 0));
}
