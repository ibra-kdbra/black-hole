<div align="center">

# BLACK HOLE

**A real-time, physically grounded black hole in your browser.**

Keplerian accretion disc · relativistic Doppler beaming · gravitational redshift · photon ring · lensing · polar jets

![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?logo=three.js&logoColor=white)
![GLSL](https://img.shields.io/badge/GLSL-shaders-ff5600)
![Vite](https://img.shields.io/badge/Vite-build-646CFF?logo=vite&logoColor=white)
![No external assets](https://img.shields.io/badge/textures-100%25%20procedural-cc00ff)

<img src="./docs/screenshots/overview.jpg" alt="Black hole overview" width="100%" />

</div>

---

Everything on screen is generated procedurally in GLSL — there is not a single texture file in the project. The scene is built in geometric units where the Schwarzschild radius is fixed, so the shadow, the photon ring, the inner edge of the disc and the plasma velocities always stay in physically correct proportion to each other.

## ✨ Features

**Physics**

- **Keplerian differential rotation** — disc plasma is advected with ω = √(GM/r³); the inner edge visibly laps the outer disc, shearing the turbulence into trailing spirals
- **Kerr spin** — drag the spin slider from Schwarzschild to near-extremal (a = 0.998): the ISCO follows the exact Bardeen–Press–Teukolsky formula (6M → 1.24M), so the disc reaches deeper, the plasma gets faster, Lense–Thirring frame dragging accelerates the flow, and the shadow tightens
- **Orbiting hot-spot flare** — a compact flare riding the flow just outside the inner edge at its true angular velocity, beamed and shifted like the plasma around it (the kind of orbiting spot the GRAVITY interferometer tracked around Sgr A*)
- **Relativistic Doppler beaming** — the approaching limb flares up (δ³ intensity boost) and blueshifts, the receding limb fades and reddens, from the actual orbital β = √(rs/2r) ≈ 0.41 c at the inner edge
- **Gravitational redshift** — emission near the ISCO is dimmed and reddened by the combined orbital + gravitational time dilation √(1 − 3rs/2r)
- **Photon ring** — a bright, thin ring of once-orbiting light hugging the shadow at √27/2 · rs, the correct lensed silhouette radius
- **Accurate proportions** — event-horizon shadow, photon sphere, and disc truncation at the ISCO (3 rs) all derive from one Schwarzschild radius
- **Gravitational lensing** — a screen-space deflection field bends the star field and disc toward the hole, strongest near the photon sphere
- **Relativistic polar jets** — collimated, precessing plasma columns launched along the spin axis (toggleable)
- **Blackbody starfield** — 12 000 stars colored by real Planckian-locus temperatures (2 500 K – 25 000 K) with per-star scintillation
- **Live observatory HUD** — pick a mass from 1 M☉ to 10¹⁰ M☉ and read off the real Schwarzschild radius in km, shadow diameter, ISCO, disc temperature (T ∝ M^(−1/4)), plasma speed, and your own clock rate at the camera's altitude

**Experience**

- **Cinematic camera system** — damped orbit controls, four named viewpoints with eased flight transitions (`1–4`), an autonomous cinematic drift mode (`C`), adjustable FOV, roll and handheld micro-shake
- **Custom glass UI** — dependency-free control panel for every physics, camera and film parameter, collapsible sections, keyboard shortcuts, help overlay
- **Disc palette themes** — quasar (default), Gargantua amber, X-ray binary blue, ember
- **Procedural nebula backdrop** — wispy interstellar dust drifting behind the starfield, still zero texture files
- **Procedural ambient audio** — a brown-noise rumble and detuned drones synthesized live with WebAudio; the well sounds deeper and louder the closer you fall (opt-in)
- **Shareable views** — one click copies a link that restores your exact settings and camera angle
- **Film pipeline** — selective bloom, gravitationally-warped chromatic aberration, luminance-weighted animated grain, vignette — each with its own slider
- **Quality & comfort** — adaptive auto quality that lowers resolution when the frame rate dips, manual low/medium/high presets, FPS meter, time scale & pause, one-key PNG screenshots (`S`), fullscreen (`F`), one-click reset, `prefers-reduced-motion` support

## 📸 Views

| Edge-on | Top-down |
| --- | --- |
| ![Edge-on](./docs/screenshots/edge-on.jpg) | ![Top-down](./docs/screenshots/top-down.jpg) |

Gargantua palette at spin a = 0.9 — the ISCO drops to 1.16 rs and the disc hugs the shadow:

<img src="./docs/screenshots/gargantua.jpg" alt="Gargantua palette, spin 0.9" width="100%" />

<img src="./docs/screenshots/interface.jpg" alt="Interface" width="100%" />

## 🚀 Setup

```bash
# Install dependencies (only the first time)
npm install

# Run the local server at localhost:5173
npm run dev

# Production build in dist/
npm run build
```

## 🎮 Controls

| Input | Action |
| --- | --- |
| drag / scroll | orbit and dolly around the singularity |
| `1` `2` `3` `4` | fly to overview / edge-on / top-down / close-up |
| `C` | cinematic mode (autonomous drift) |
| `Space` | pause time |
| `S` | save a PNG screenshot |
| `F` | fullscreen |
| `H` | hide the interface |
| `K` | shortcuts panel |

Every parameter is also live in the side panel — mass, disc flow, beaming and redshift strength, turbulence, jets, lensing, bloom, grain, camera roll…

## 🔭 How the physics works

The scene uses geometric units with rs = 0.5 world units. From that single number:

| Quantity | Relation | World units |
| --- | --- | --- |
| Photon sphere | 1.5 rs | 0.75 |
| Shadow radius | √27/2 · rs | ≈ 1.30 |
| ISCO / disc inner edge | 3 rs | 1.5 |
| Orbital speed at radius r | β = √(rs / 2r) | 0.41 c at ISCO |

The disc fragment shader advects four octaves of periodic perlin noise with the local Keplerian angular velocity, then applies the relativistic Doppler factor δ = 1/γ(1 − β·cos θ) as a δ³ intensity boost with a spectral tilt, and the time-dilation factor √(1 − 3rs/2r) as dimming and reddening. The mass slider never rescales the scene — Schwarzschild geometry is scale-free — it drives the real-unit readouts in the HUD instead.

The lensing is a screen-space approximation: two masks (a camera-facing halo and an in-plane disc field) are rendered to a deflection buffer, and the composition pass bends sample coordinates toward the singularity's projected position with that strength — cheap enough for any GPU, convincing enough to smear the star field around the shadow.

## 🗂 Project structure

```
sources/
├── index.js                 # entry
├── experience/
│   ├── Experience.js        # orchestrator, render pipeline, post-processing
│   ├── Physics.js           # Schwarzschild model + real-unit readouts
│   ├── Disc.js              # accretion disc (ISCO-truncated, palettes, hot spot)
│   ├── BlackHole.js         # shadow + photon ring
│   ├── Jets.js              # relativistic polar jets
│   ├── Stars.js             # blackbody starfield
│   ├── Nebula.js            # procedural background dust
│   ├── Noises.js            # baked perlin octaves render target
│   ├── Distortion.js        # lensing deflection field
│   ├── CameraRig.js         # orbit + presets + cinematic mode
│   ├── AmbientAudio.js      # WebAudio soundscape
│   └── UI.js                # control panel, HUD, shortcuts
└── shaders/                 # all GLSL (disc, stars, photonRing, jet, nebula,
                             # distortion, composition, film, noises)
```

## 👤 Author

**ibra-kdbra** — shader breakdowns live in [`sources/shaders/README.md`](./sources/shaders/README.md)
