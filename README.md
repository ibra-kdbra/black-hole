# Black Hole

A real-time, physically grounded black hole visualization for the browser, built with three.js and custom GLSL shaders.

![Three.js](https://img.shields.io/badge/three.js-0.185-black?logo=three.js&logoColor=white)
![Vite](https://img.shields.io/badge/vite-8-646CFF?logo=vite&logoColor=white)
![GLSL](https://img.shields.io/badge/shaders-GLSL-ff5600)
![Procedural](https://img.shields.io/badge/textures-100%25%20procedural-cc00ff)

<img src="./docs/screenshots/overview.jpg" alt="Overview of the black hole with accretion disc, photon ring and polar jets" width="100%" />

Every texture is generated procedurally in GLSL, and every scale in the scene derives from a single Schwarzschild radius, so the shadow, the photon ring, the disc truncation and the plasma velocities always stay in correct physical proportion to one another.

## Table of contents

- [Overview](#overview)
- [Getting started](#getting-started)
- [Controls](#controls)
- [Features](#features)
- [Physics model](#physics-model)
- [Gallery](#gallery)
- [Architecture](#architecture)
- [Performance](#performance)
- [References](#references)
- [Author](#author)

## Overview

The application renders a Kerr black hole with its accretion disc, photon ring, relativistic jets and gravitationally lensed star field, and exposes every physical and cinematic parameter through a custom interface. Two rendering modes are available:

- **Real-time mode**: a rasterized scene with screen-space lensing, tuned to run on any GPU.
- **Geodesic photo mode**: every pixel integrates a true null geodesic of the metric (Schwarzschild, or Kerr when the hole spins), so the shadow, the photon ring and the lensed arcs of the disc emerge from the geometry itself.

Three layers of explanation are built in: a narrated guided tour for first-time visitors, a hover inspector that reports live physics for whatever the pointer rests on, and a science panel listing every equation used together with its source paper.

## Getting started

Requires Node.js 20.19 or later.

```bash
npm install      # install dependencies
npm run dev      # development server at http://localhost:5173
npm run build    # production build in dist/
npm run preview  # serve the production build
```

## Controls

| Input | Action |
| --- | --- |
| drag / scroll | orbit and dolly around the singularity |
| hover | live physics for whatever you point at |
| `1` `2` `3` `4` | fly to overview / edge-on / top-down / close-up |
| `C` | cinematic mode (autonomous drift) |
| `G` | guided tour |
| `P` | geodesic photo mode |
| `T` | feed a star to the hole (tidal disruption) |
| `I` | science panel: equations and references |
| `Space` | pause time |
| `S` | save a supersampled PNG screenshot |
| `F` | fullscreen |
| `H` | hide the interface |
| `K` | shortcuts panel |

Every parameter is also exposed in the side panel: mass, spin, disc flow, beaming and redshift strength, turbulence, jets, lensing, bloom, grain, camera roll and more.

## Features

### Physics

| Feature | Model |
| --- | --- |
| Disc dynamics | Keplerian differential rotation, Ω = √(GM/r³), with bounded flow-map shear and radial inflow |
| Kerr spin | Exact Bardeen-Press-Teukolsky ISCO (6M at a = 0 down to 1.24M near extremal), Lense-Thirring frame dragging, tightening shadow |
| Doppler beaming | δ³ intensity boost with spectral tilt from the true orbital β = √(rs/2r), 0.41c at the inner edge |
| Gravitational redshift | Combined orbital and gravitational time dilation √(1 − 3rs/2r) |
| Photon ring | Bright ring at the correct lensed silhouette radius, √27/2 · rs |
| Geodesic ray marching | Schwarzschild fast path d²x/dλ² = −3/2 rs h² x/r⁵; Kerr-Schild Hamiltonian H = ½[p² − E² − f(l·p+E)²] when spinning |
| Tidal disruption events | A star on a parabolic infall, spaghettified at the tidal radius into 4,500 gravity-integrated debris particles feeding an accretion flare |
| Hot-spot flares | A compact flare riding the flow at its true angular velocity, as observed by the GRAVITY interferometer at Sgr A* |
| Relativistic jets | Polar plasma columns, spin energy extracted magnetically (Blandford-Znajek) |
| Star field | 12,000 stars on the Planckian locus (2,500 K to 25,000 K) with per-star scintillation |

### Interface

- Custom dependency-free control panel, observatory HUD with real-unit readouts (Schwarzschild radius, shadow diameter, ISCO, disc temperature, time dilation at the camera)
- Guided tour with step progress, starting automatically on a first visit
- Hover inspector: local radius, orbital speed, temperature and Doppler state for the exact point under the cursor
- Science panel with every equation and reference
- Cinematic camera rig: four presets with eased flights, autonomous drift mode, adjustable FOV, roll and hand-held shake
- Shareable view links restoring all settings and the camera angle
- Disc palette themes, procedural nebula backdrop, opt-in procedural ambient audio
- Film pipeline: selective bloom, chromatic aberration, luminance-weighted grain, vignette

### Engineering

- All shader programs precompile behind the intro overlay: no mid-session compile stalls
- Allocation-free render loop; resizes and geometry rebuilds coalesce to one per frame
- Adaptive quality lowers the pixel-ratio cap when the frame rate drops
- WebGL context-loss recovery, full `destroy()` teardown, `prefers-reduced-motion` support
- Supersampled screenshot capture, background-tab audio suspension

## Physics model

The scene uses geometric units with rs = 0.5 world units. Every scale derives from that number:

| Quantity | Relation | World units |
| --- | --- | --- |
| Photon sphere | 1.5 rs | 0.75 |
| Shadow radius | √27/2 · rs | ≈ 1.30 |
| ISCO / disc inner edge | 3 rs (a = 0) | 1.5 |
| Orbital speed at radius r | β = √(rs / 2r) | 0.41c at the ISCO |

The disc fragment shader advects four octaves of periodic Perlin noise with the local Keplerian angular velocity. The rotation is split into a rigid component and a bounded, flow-map-crossfaded differential shear, so the turbulence keeps churning at any runtime instead of winding into static filaments, while a radial drift keeps the plasma visibly falling inward. The relativistic Doppler factor δ = 1/[γ(1 − β cos θ)] is applied as a δ³ intensity boost with a spectral tilt, and the time-dilation factor √(1 − 3rs/2r) as dimming and reddening. The mass slider never rescales the scene, since Schwarzschild geometry is scale free; it drives the real-unit readouts in the HUD instead.

In real-time mode the lensing is a screen-space approximation: two masks are rendered to a deflection buffer and the composition pass bends sample coordinates toward the singularity with that strength. In geodesic photo mode the approximation is replaced entirely by per-pixel integration of the metric.

## Gallery

Edge-on and top-down views:

| Edge-on | Top-down |
| --- | --- |
| ![Edge-on view](./docs/screenshots/edge-on.jpg) | ![Top-down view](./docs/screenshots/top-down.jpg) |

Gargantua palette at spin a = 0.9. The ISCO drops to 1.16 rs and the disc hugs the shadow:

<img src="./docs/screenshots/gargantua.jpg" alt="Gargantua palette at spin 0.9" width="100%" />

Geodesic photo mode. The far side of the disc arcs over and under the shadow exactly as general relativity predicts:

<img src="./docs/screenshots/geodesic.jpg" alt="Geodesic photo mode" width="100%" />

Kerr metric at spin a = 0.9 in geodesic mode. The shadow shrinks, turns D-shaped with the flat edge on the approaching side, and a prograde photon arc appears inside it:

<img src="./docs/screenshots/kerr.jpg" alt="Kerr geodesic mode at spin 0.9" width="100%" />

The interface:

<img src="./docs/screenshots/interface.jpg" alt="Control panel and observatory HUD" width="100%" />

## Architecture

```
sources/
├── index.js                 # entry
├── experience/
│   ├── Experience.js        # orchestrator, render pipeline, post-processing
│   ├── Physics.js           # Schwarzschild/Kerr model, real-unit readouts
│   ├── Disc.js              # accretion disc (ISCO-truncated, palettes, hot spot)
│   ├── BlackHole.js         # shadow and photon ring
│   ├── GeodesicView.js      # ray-marched photo mode
│   ├── TidalDisruption.js   # star infall, debris integration, accretion flare
│   ├── Jets.js              # relativistic polar jets
│   ├── Stars.js             # blackbody star field
│   ├── Nebula.js            # procedural background dust
│   ├── Noises.js            # baked Perlin octaves render target
│   ├── Distortion.js        # screen-space lensing deflection field
│   ├── CameraRig.js         # orbit controls, presets, cinematic mode
│   ├── AmbientAudio.js      # WebAudio soundscape
│   ├── Inspector.js         # hover tooltips with live physics
│   └── UI.js                # control panel, HUD, tour, science panel
└── shaders/                 # all GLSL (disc, stars, photonRing, jet, nebula,
                             # geodesic, distortion, composition, film, noises)
```

Each frame, the world renders into a color target and the deflection masks into a single-channel target; the composition pass applies the lensing and chromatic aberration, then bloom and a film pass complete the pipeline. In geodesic mode the composition inputs are replaced by the ray-marching quad, and bloom and film still apply.

## Performance

The render loop allocates no objects, shader programs are compiled up front while the intro overlay covers the canvas, resize bursts and spin-driven geometry rebuilds are coalesced to one per frame, and the default quality mode adapts resolution to the measured frame rate. A complete `destroy()` releases every geometry, material, texture, render target and listener.

## References

1. J. M. Bardeen, W. H. Press, S. A. Teukolsky (1972). Rotating black holes: locally nonrotating frames, energy extraction, and scalar synchrotron radiation. *ApJ* 178.
2. N. I. Shakura, R. A. Sunyaev (1973). Black holes in binary systems: observational appearance. *A&A* 24.
3. J.-P. Luminet (1979). Image of a spherical black hole with thin accretion disk. *A&A* 75.
4. R. D. Blandford, R. L. Znajek (1977). Electromagnetic extraction of energy from Kerr black holes. *MNRAS* 179.
5. O. James, E. von Tunzelmann, P. Franklin, K. S. Thorne (2015). Gravitational lensing by spinning black holes in astrophysics, and in the movie Interstellar. *CQG* 32.
6. GRAVITY Collaboration (2018). Detection of orbital motions near the last stable circular orbit of the massive black hole Sgr A*. *A&A* 618.
7. Event Horizon Telescope Collaboration (2019). First M87 Event Horizon Telescope results. *ApJL* 875.

## Author

**ibra-kdbra**

Shader notes are available in [`sources/shaders/README.md`](./sources/shaders/README.md).
