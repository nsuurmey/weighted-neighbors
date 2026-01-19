# Weighted Neighbors: The Kriging Quest

## Product Requirements Document (V1 MVP)

### Overview

**Weighted Neighbors** is an interactive web app that teaches Kriging interpolation through gameplay. Users reconstruct a hidden geological surface by strategically placing sample points and tuning variogram parameters.

**Target Users:** Geoscience students, data scientists entering energy/environmental sectors, industry professionals wanting an intuitive refresher.

**Deployment:** Static hosting (e.g., GitHub Pages, Netlify). Desktop only.

---

## Core Learning Objective

Teach the two-phase Kriging workflow:
1. **Variography:** Fit a model to the empirical semivariogram
2. **Prediction:** Use that model to interpolate a surface

Users should learn by doing—experiencing how sample placement and parameter tuning affect surface accuracy.

---

## Gameplay Loop

### Setup
- System generates a hidden 64×64 "truth" surface using a **Spherical covariance model** with randomized parameters (randomized seed each session)
- User sees a blank canvas and has **10 sample clicks** (displayed as countdown)

### Play
1. **Click to sample:** Each click reveals the true Z-value at that (x, y) coordinate. Remaining clicks decrement.
2. **View empirical semivariogram:** As samples accumulate (minimum 3-4 points), display the empirical semivariogram—binned lag-distance (x-axis) vs. semivariance (y-axis).
3. **Fit the model:** User adjusts three sliders:
   - **Nugget:** Y-intercept (measurement error / micro-scale variation). Range: 0 to [sill value].
   - **Sill:** Total variance where model flattens. Range: 0 to ~2× observed max semivariance.
   - **Range:** Distance where autocorrelation stops. Range: 0 to ~half the grid diagonal (~45 units).
4. **See the fitted curve:** Overlay the user's Spherical model curve on the empirical semivariogram in real-time.
5. **Generate prediction surface:** Ordinary Kriging interpolation using user's samples + fitted parameters. Update in real-time as sliders move.

### Scoring
- **Metric:** RMSE between predicted surface and truth surface
- **Target:** Dynamic threshold = 15% of the truth surface's standard deviation (gives a meaningful but achievable goal)
- **Win condition:** RMSE ≤ target before or after exhausting clicks
- **Lose condition:** 10 clicks used and RMSE > target → offer "Try Again" (new random surface)

---

## UI Layout (Single Page)

```
┌─────────────────────────────────────────────────────────────────┐
│  WEIGHTED NEIGHBORS                          Samples: ●●●●●○○○○○ │
├───────────────────────────────┬─────────────────────────────────┤
│                               │                                 │
│   [2D Sample Canvas]          │   [Semivariogram Chart]         │
│   64×64 grid, click to sample │   Empirical points + fitted     │
│   Show placed points          │   Spherical curve               │
│                               │                                 │
├───────────────────────────────┼─────────────────────────────────┤
│                               │                                 │
│   [Predicted Surface]         │   [Parameter Sliders]           │
│   3D or heatmap view          │   Nugget: ────●────             │
│   Updates in real-time        │   Sill:   ────●────             │
│                               │   Range:  ────●────             │
│                               │                                 │
├───────────────────────────────┴─────────────────────────────────┤
│  Current RMSE: 12.4    Target: ≤ 8.5    [Reveal Truth] [Reset]  │
└─────────────────────────────────────────────────────────────────┘
```

### Panel Details

1. **Sample Canvas (top-left):** 2D top-down view of the 64×64 grid. Clicking places a sample marker and reveals value (tooltip or label). Grayscale or subtle gradient background showing predicted values as context.

2. **Semivariogram Chart (top-right):** 
   - X-axis: Lag distance (0 to ~45)
   - Y-axis: Semivariance
   - Blue dots: Empirical semivariogram (binned from user's samples)
   - Orange line: User's fitted Spherical model curve
   - Update curve in real-time as sliders move

3. **Predicted Surface (bottom-left):** Heatmap (2D) view of the Kriging-interpolated surface. Color ramp from low to high Z-values. Updates as samples are added or sliders change.

4. **Parameter Sliders (bottom-right):**
   - Nugget, Sill, Range with numeric readouts
   - Reasonable defaults: Nugget=0, Sill=auto-estimated from data variance, Range=16

5. **Score Bar (bottom):** Current RMSE, target RMSE, and action buttons.

6. **Reveal Truth Button:** Toggle to show/hide the true surface (split view or overlay) for comparison. Available anytime but encouraged after attempts.

---

## Tutorial (3-Panel Overlay on First Load)

**Panel 1:** "Your mission: Reconstruct the hidden surface beneath."  
*[Show blurred/mystery surface graphic]*

**Panel 2:** "Click to reveal true values. You have 10 samples—choose wisely."  
*[Show sample canvas with click animation]*

**Panel 3:** "Fit the curve to your data by adjusting Nugget, Sill, and Range. Lower RMSE = better match."  
*[Show semivariogram with slider interaction]*

**[Got it, let's go!]** button dismisses tutorial. Store flag in localStorage so it only shows once.

---

## Technical Specifications

| Component | Technology |
|-----------|------------|
| Framework | React (Vite for fast builds) |
| 2D Canvas/Grid | HTML Canvas or SVG |
| Semivariogram Chart | D3.js or Recharts |
| Heatmap Surface | Plotly.js (heatmap) or custom Canvas |
| Kriging Math | `kriging.js` (client-side, no server) |
| State Management | React useState/useReducer (simple enough, no Redux needed) |
| Styling | Tailwind CSS (clean/minimal aesthetic) |

### Kriging Implementation Notes

**Empirical Semivariogram Calculation:**
```
For all pairs of sample points:
  - Calculate distance h between points
  - Calculate squared difference (z_i - z_j)²
  - Bin by distance (e.g., 10 bins from 0 to max_distance)
  - Average semivariance per bin = 0.5 × mean(squared differences in bin)
```

**Spherical Model Formula:**
```
γ(h) = 
  - 0                                           if h = 0
  - Nugget + (Sill - Nugget) × [1.5(h/Range) - 0.5(h/Range)³]   if 0 < h ≤ Range
  - Sill                                        if h > Range
```

**Ordinary Kriging:** Use `kriging.js` library which handles the matrix math for weights and prediction.

---

## Truth Surface Generation

On each new game:
1. Generate random Spherical model parameters:
   - True Nugget: random(0, 5)
   - True Sill: random(15, 40)
   - True Range: random(10, 30)
2. Use these to generate a 64×64 surface via simulation (Cholesky decomposition of covariance matrix, or use kriging.js's train function on synthetic scattered points)
3. Store truth surface in state; never show directly until "Reveal Truth" is clicked

---

## Success Criteria

- User can complete a round in < 5 minutes
- RMSE visibly drops as user improves variogram fit
- Semivariogram chart clearly shows relationship between empirical data and fitted curve
- App runs smoothly with real-time slider updates (target: < 100ms latency on parameter change)

---

## Out of Scope for V1

- Anisotropy
- Multiple variogram models (Exponential, Gaussian)
- Variance/uncertainty map
- Leaderboards
- Mobile support
- Export functionality
- Sound effects

---

## File Structure (Suggested)

```
weighted-neighbors/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── components/
│   │   ├── SampleCanvas.jsx
│   │   ├── Semivariogram.jsx
│   │   ├── PredictedSurface.jsx
│   │   ├── ParameterSliders.jsx
│   │   ├── ScoreBar.jsx
│   │   └── Tutorial.jsx
│   ├── utils/
│   │   ├── kriging.js (or npm package)
│   │   ├── generateTruthSurface.js
│   │   ├── calculateEmpiricalSemivariogram.js
│   │   └── sphericalModel.js
│   └── styles/
│       └── index.css (Tailwind)
└── public/
```

---

## Notes for Claude Code

- Use `kriging.js` npm package if available, otherwise implement Ordinary Kriging from scratch (matrix operations can use a small linear algebra helper)
- Prioritize responsiveness—sliders should feel instant
- Keep the UI minimal: no flashy animations, just clean feedback
- Test with edge cases: user clicks all 10 points in a cluster vs. spread out
- Default slider values should give a "reasonable" starting surface so users see something immediately
