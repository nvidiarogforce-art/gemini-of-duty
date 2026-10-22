# BLACKLINE // TACTICAL RESPONSE (`gemini-of-duty`)

An original, fast-paced tactical first-person shooter built from scratch with **Three.js**, **TypeScript**, **Vite**, and procedural **Web Audio API**. Pits **Aegis Task Force** against **Kestrel Syndicate** across three distinct multi-lane tactical arenas.

---

## Features

### 3 Fully Realized Playable Maps
- **Breakwater Terminal** (`breakwater`): Coastal container terminal during blue hour with wet concrete specular reflections, massive overhead Gantry Crane landmark, maintenance warehouse interior, and contested elevated catwalk.
- **Mesa Relay** (`mesa`): Sunlit arid canyon communications array with a giant rotating deep-space parabolic dish, server processing wings, stepped sandstone canyon flank, and north ridge overlook.
- **Northstar Facility** (`northstar`): Arctic cryo-research station featuring a central Cryo-Dome and rotating Doppler radar mast, frosted asphalt service yard with tracked snowplow, warm occupied lab complex, and heated skybridge.

### 5 Weapons + Frag Grenades
- **M4A8 Vanguard**: Select-fire assault rifle with learnable recoil pattern and holographic optic.
- **VX-9 Spectre**: High-RPM submachine gun with micro-reflex sight and rapid handling.
- **M870 Breacher**: 8-pellet tactical pump-action shotgun with side-saddle shell carrier.
- **SR-25 Longbow**: Designated marksman rifle with high-magnification 3D optical scope bore.
- **P226 Sentinel**: Sidearm with tritium night sights and crisp semi-auto cadence.
- **M67 Frag Grenade**: Bouncing projectile with radial line-of-sight damage check.

### Game Modes & Bot AI
- **Team Deathmatch (4v4)**: Aegis vs. Kestrel with balanced spawn evaluation.
- **Free-for-All (8 Combatants)**: Intense all-out arena combat.
- **Tactical Practice / Firing Range**: Free testing sandbox with live target dummies, ammo resupply, and instant weapon switching.
- **Autonomous Bot AI**: Articulated 3D operator models with A* waypoint pathfinding, vision-cone perception, sound cue investigation, and combat strafing.

### Engine & Technical Highlights
- **100% Procedural PBR Material Library**: Procedural canvas-generated albedo, roughness, and normal maps (wet concrete, sandstone, frosted asphalt, corrugated steel).
- **Zero-Dependency Procedural Audio**: 100% synthesized Web Audio API soundscape (distinct weapon cracks, footsteps per surface, 3D spatialized panners, hit/kill chimes).
- **Physics & Hitscan**: Swept cylinder-vs-AABB sliding, step-up ($\le 0.42\text{m}$), crouch clearance checks, and separate head/body hitboxes.
- **Ultra-High Performance**: 120–144+ FPS steady-state at 1080p.

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/)

### Installation
```bash
# Clone the repository
git clone https://github.com/nvidiarogforce-art/gemini-of-duty.git
cd gemini-of-duty

# Install dependencies
npm install

# Start local development server
npm run dev
```
Open your browser to `http://localhost:5173`.

---

## Controls Reference

| Action | Key / Input |
| :--- | :--- |
| **Move** | `W`, `A`, `S`, `D` |
| **Aim & Look** | `Mouse` (click canvas to lock pointer) |
| **Fire** | `Left Mouse Button` |
| **Aim Down Sights (ADS)** | `Right Mouse Button` (Hold) |
| **Sprint** | `Left Shift` (Hold while moving forward) |
| **Crouch** | `C` (Toggle) or `Left Ctrl` (Hold) |
| **Jump** | `Spacebar` |
| **Reload** | `R` |
| **Primary Weapon** | `1` |
| **Sidearm (P226)** | `2` |
| **Quick Swap** | `Q` or `Mouse Wheel` |
| **Frag Grenade** | `G` |
| **Scoreboard** | `Tab` (Hold) |
| **Pause / Settings** | `Esc` |
| **Sandbox: Toggle Bot AI** | `F1` |
| **Sandbox: Resupply Ammo & HP** | `F2` |
| **Sandbox: Cycle Primary Weapon** | `F3` |

---

## Testing & Verification

```bash
# Run unit & map geometry tests
npm test

# Build production bundle
npm run build

# Run automated headless browser verification & telemetry inspection
node scripts/inspect_and_capture.mjs
```

---

## License

MIT
