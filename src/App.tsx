import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { generateSurface } from './utils/surfaceGenerator';
import {
  Sample,
  VariogramParams,
  sphericalVariogram,
  calculateSemivariogram,
  calculateRMSE,
  calculateStdDev,
  kригingPrediction,
} from './utils/kriging';

interface GameState {
  trueSurface: number[][];
  samples: Sample[];
  clicksRemaining: number;
  params: VariogramParams;
  predictedSurface: number[][] | null;
  gameOver: boolean;
  won: boolean;
  rmse: number | null;
  targetRmse: number;
}

const SURFACE_SIZE = 64;
const MAX_CLICKS = 10;
const RMSE_THRESHOLD = 0.15; // 15% of std dev

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [empiricalVariogram, setEmpiricalVariogram] = useState<
    { distance: number; semivariance: number }[]
  >([]);

  // Initialize game
  useEffect(() => {
    startNewGame();
  }, []);

  // Update predictions when params change
  useEffect(() => {
    if (!gameState || gameState.samples.length === 0) return;

    const newPredicted = kригingPrediction(
      SURFACE_SIZE,
      SURFACE_SIZE,
      gameState.samples,
      gameState.params,
      2 // Use step for performance
    );

    const rmse = calculateRMSE(gameState.trueSurface, newPredicted);
    const relativeRmse = rmse / gameState.targetRmse;

    setGameState(prev => ({
      ...prev!,
      predictedSurface: newPredicted,
      rmse: rmse,
      won: relativeRmse <= RMSE_THRESHOLD && !prev!.gameOver,
      gameOver: prev!.gameOver || relativeRmse <= RMSE_THRESHOLD,
    }));

    // Update empirical variogram
    const empirical = calculateSemivariogram(gameState.samples, 3);
    setEmpiricalVariogram(empirical);
  }, [gameState?.samples, gameState?.params]);

  function startNewGame() {
    const trueSurface = generateSurface(SURFACE_SIZE, SURFACE_SIZE, Math.random() * 10000);
    const stdDev = calculateStdDev(trueSurface);
    const targetRmse = stdDev * 0.15;

    setGameState({
      trueSurface,
      samples: [],
      clicksRemaining: MAX_CLICKS,
      params: { nugget: 0.1, sill: 50, range: 15 },
      predictedSurface: null,
      gameOver: false,
      won: false,
      rmse: null,
      targetRmse,
    });

    setEmpiricalVariogram([]);
  }

  function handleSurfaceClick(x: number, y: number) {
    if (!gameState || gameState.gameOver || gameState.clicksRemaining <= 0) return;

    const xi = Math.round(x * SURFACE_SIZE);
    const yi = Math.round(y * SURFACE_SIZE);

    if (xi < 0 || xi >= SURFACE_SIZE || yi < 0 || yi >= SURFACE_SIZE) return;

    // Check if already sampled
    if (gameState.samples.some(s => s.x === xi && s.y === yi)) return;

    const trueValue = gameState.trueSurface[yi][xi];

    setGameState(prev => ({
      ...prev!,
      samples: [...prev!.samples, { x: xi, y: yi, z: trueValue }],
      clicksRemaining: prev!.clicksRemaining - 1,
      gameOver:
        prev!.clicksRemaining - 1 === 0 && !prev!.won,
    }));
  }

  function updateParam(param: keyof VariogramParams, value: number) {
    if (!gameState) return;

    setGameState(prev => ({
      ...prev!,
      params: { ...prev!.params, [param]: value },
    }));
  }

  if (!gameState) return <div className="loading">Loading...</div>;

  const relativeRmse = gameState.rmse ? gameState.rmse / gameState.targetRmse : Infinity;

  return (
    <div className="app">
      <header className="header">
        <h1>Weighted Neighbors</h1>
        <p>Learn kriging interpolation through interactive gameplay</p>
      </header>

      <div className="main-container">
        <div className="game-panel">
          <div className="status">
            <div className="status-item">
              <span className="label">Samples Taken:</span>
              <span className="value">{gameState.samples.length}/{MAX_CLICKS}</span>
            </div>
            <div className="status-item">
              <span className="label">Current RMSE:</span>
              <span className="value">
                {gameState.rmse !== null ? gameState.rmse.toFixed(2) : '—'}
              </span>
            </div>
            <div className="status-item">
              <span className="label">Target RMSE:</span>
              <span className="value">{gameState.targetRmse.toFixed(2)}</span>
            </div>
            <div className="status-item">
              <span className="label">Progress:</span>
              <span className="value">
                {(Math.min(relativeRmse, 1) * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {gameState.gameOver && (
            <div className={`game-result ${gameState.won ? 'won' : 'lost'}`}>
              {gameState.won ? (
                <>
                  <h2>Success!</h2>
                  <p>You successfully fitted the kriging model!</p>
                  <p>Final RMSE: {gameState.rmse?.toFixed(2)}</p>
                </>
              ) : (
                <>
                  <h2>Game Over</h2>
                  <p>You ran out of samples. Keep trying!</p>
                  <p>
                    Final RMSE: {gameState.rmse?.toFixed(2)} (needed{' '}
                    {gameState.targetRmse.toFixed(2)})
                  </p>
                </>
              )}
              <button className="btn" onClick={startNewGame}>
                Play Again
              </button>
            </div>
          )}

          <div className="controls">
            <h3>Variogram Parameters</h3>

            <div className="control-group">
              <label>
                Nugget: {gameState.params.nugget.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="50"
                step="0.5"
                value={gameState.params.nugget}
                onChange={e =>
                  updateParam('nugget', parseFloat(e.target.value))
                }
              />
            </div>

            <div className="control-group">
              <label>
                Sill: {gameState.params.sill.toFixed(2)}
              </label>
              <input
                type="range"
                min="10"
                max="200"
                step="1"
                value={gameState.params.sill}
                onChange={e =>
                  updateParam('sill', parseFloat(e.target.value))
                }
              />
            </div>

            <div className="control-group">
              <label>
                Range: {gameState.params.range.toFixed(2)}
              </label>
              <input
                type="range"
                min="1"
                max="50"
                step="0.5"
                value={gameState.params.range}
                onChange={e =>
                  updateParam('range', parseFloat(e.target.value))
                }
              />
            </div>
          </div>

          <div className="instructions">
            <h3>How to Play</h3>
            <ol>
              <li>Click on the surface map to sample points (max 10)</li>
              <li>Adjust the variogram parameters using the sliders</li>
              <li>Watch the semivariogram update with your samples</li>
              <li>Fit your model to achieve RMSE ≤ 15% of target</li>
              <li>The prediction surface updates in real-time</li>
            </ol>
          </div>
        </div>

        <div className="visualization-panel">
          <div className="chart-container">
            <h3>True Surface (Samples: {gameState.samples.length})</h3>
            <SurfaceVisualization
              surface={gameState.trueSurface}
              samples={gameState.samples}
              onClick={handleSurfaceClick}
            />
          </div>

          <div className="chart-container">
            <h3>Predicted Surface</h3>
            {gameState.predictedSurface ? (
              <SurfaceVisualization
                surface={gameState.predictedSurface}
                samples={[]}
              />
            ) : (
              <div className="placeholder">No prediction yet. Sample some points!</div>
            )}
          </div>

          {empiricalVariogram.length > 0 && (
            <div className="chart-container">
              <h3>Semivariogram</h3>
              <VariogramPlot
                empirical={empiricalVariogram}
                params={gameState.params}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface SurfaceVisualizationProps {
  surface: number[][];
  samples: Sample[];
  onClick?: (x: number, y: number) => void;
}

function SurfaceVisualization({
  surface,
  samples,
  onClick,
}: SurfaceVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Draw heatmap
    const pixelData = ctx.createImageData(width, height);
    const data = pixelData.data;

    for (let y = 0; y < Math.min(surface.length, height); y++) {
      for (let x = 0; x < Math.min(surface[y]?.length ?? 0, width); x++) {
        const value = surface[y][x];
        const idx = (y * width + x) * 4;

        // Viridis colormap
        const color = valueToColor(value / 100);
        data[idx] = color.r;
        data[idx + 1] = color.g;
        data[idx + 2] = color.b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(pixelData, 0, 0);

    // Draw samples
    for (const sample of samples) {
      const x = (sample.x / SURFACE_SIZE) * width;
      const y = (sample.y / SURFACE_SIZE) * height;

      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 5, y - 5);
      ctx.lineTo(x + 5, y + 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 5, y - 5);
      ctx.lineTo(x - 5, y + 5);
      ctx.stroke();
    }
  }, [surface, samples]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onClick || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    onClick(x, y);
  };

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={400}
      onClick={handleClick}
      style={{ border: '1px solid #ccc', cursor: onClick ? 'crosshair' : 'default' }}
    />
  );
}

function valueToColor(t: number): { r: number; g: number; b: number } {
  // Viridis colormap
  const colors = [
    { r: 68, g: 1, b: 84 },
    { r: 71, g: 16, b: 99 },
    { r: 70, g: 33, b: 102 },
    { r: 68, g: 51, b: 101 },
    { r: 64, g: 69, b: 97 },
    { r: 57, g: 87, b: 100 },
    { r: 48, g: 104, b: 107 },
    { r: 37, g: 121, b: 110 },
    { r: 26, g: 137, b: 110 },
    { r: 16, g: 154, b: 108 },
    { r: 13, g: 170, b: 102 },
    { r: 27, g: 186, b: 91 },
    { r: 49, g: 202, b: 75 },
    { r: 77, g: 216, b: 54 },
    { r: 115, g: 228, b: 29 },
    { r: 163, g: 238, b: 9 },
    { r: 216, g: 244, b: 20 },
    { r: 254, g: 246, b: 52 },
  ];

  const idx = Math.min(colors.length - 2, Math.floor(t * (colors.length - 1)));
  const a = colors[idx];
  const b = colors[idx + 1];
  const frac = t * (colors.length - 1) - idx;

  return {
    r: Math.round(a.r + (b.r - a.r) * frac),
    g: Math.round(a.g + (b.g - a.g) * frac),
    b: Math.round(a.b + (b.b - a.b) * frac),
  };
}

interface VariogramPlotProps {
  empirical: { distance: number; semivariance: number }[];
  params: VariogramParams;
}

function VariogramPlot({ empirical, params }: VariogramPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || empirical.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;

    // Clear
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    // Calculate bounds
    const maxDistance = Math.max(...empirical.map(e => e.distance), params.range * 1.5);
    const maxSemivariance = Math.max(...empirical.map(e => e.semivariance), params.sill * 1.2);

    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;

    // Draw axes
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.lineTo(width - padding, padding);
    ctx.stroke();

    // Draw labels
    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Distance', width / 2, height - 10);
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Semivariance', 0, 0);
    ctx.restore();

    // Helper to convert data coords to canvas coords
    const toCanvasX = (d: number) => padding + (d / maxDistance) * plotWidth;
    const toCanvasY = (s: number) => height - padding - (s / maxSemivariance) * plotHeight;

    // Draw empirical points
    ctx.fillStyle = 'blue';
    for (const point of empirical) {
      const x = toCanvasX(point.distance);
      const y = toCanvasY(point.semivariance);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw model curve
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i <= 100; i++) {
      const distance = (i / 100) * maxDistance;
      const semivariance = sphericalVariogram(distance, params);
      const x = toCanvasX(distance);
      const y = toCanvasY(semivariance);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Draw legend
    ctx.fillStyle = 'blue';
    ctx.fillRect(width - 120, 10, 10, 10);
    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Empirical', width - 105, 18);

    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width - 120, 35);
    ctx.lineTo(width - 105, 35);
    ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.fillText('Model', width - 105, 38);
  }, [empirical, params]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={300}
      style={{ border: '1px solid #ccc' }}
    />
  );
}
