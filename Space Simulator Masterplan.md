**Role:** Senior Graphics & Physics Programmer. Build a 60fps 3D Space Simulator using Vanilla JavaScript, Three.js, and REBOUND (Wasm).

**Core Objective:** Create an interactive "God-mode" sandbox where users drag space objects into a high-accuracy N-body physics simulation. Implement a custom adaptive LOD system, a strict slow-motion time controller, Raycast property inspection, procedural shaders, and a smooth loading experience.

**1\. Tech Stack & Initial Loading (NEW):**

* **Renderer & Physics:** Three.js with postprocessing (Unreal Bloom, Additive Blending). REBOUND.js for N-body gravity. Implement DISTANCE\_SCALE and SIZE\_SCALE to fit AU units on screen.  
* **Loading Screen:** Create a full-screen CSS overlay that displays upon launching. It must show a progress bar or percentage tied to Three.js's LoadingManager (tracking the Wasm engine and initial assets). Once loading hits 100%, elegantly fade out the overlay to reveal the 3D starfield.

**2\. SpaceLODManager Architecture (CRITICAL):**

* **Budget:** Limit High-Res (4K) objects to exactly 3 at once.  
* **Priority Order:** 1\. Selected object, 2\. Hovered object, 3\. Closest visible objects.  
* **Distance Logic:** Default to Low-Res. Upgrade to High-Res if distance \< 150 units or object is selected/hovered. Downgrade to Low-Res when distance \> 200 units (Hysteresis).  
* **Stability:** Do not reload or flicker between LOD states. If an object has no separate low/high versions, use the same model for both LOD states seamlessly.

**3\. Asset Pipeline & Dynamic Loader:**

* **The Folder:** Do not create a new asset folder structure. Inspect and adapt to my existing root folder named exactly 3D models/. The loader MUST support searching through nested folders.  
* **ModelLoader Logic:** Load low-res assets first (\[name\]\_1k.glb). Upgrade to 4K only when LOD requires it.  
* **The Fallback Chain:** \[name\]\_4k.glb \-\> \[name\]\_1k.glb \-\> \[name\].glb.  
* **Cache & Misses:** Cache all loaded assets. *Crucially*, you must flag and avoid repeated failed attempts to load missing 4K files. If all file attempts fail, gracefully fallback to a colored THREE.SphereGeometry.

**4\. UI & Categorization (Exactly 6 Categories):**

* Create a collapsible HTML/CSS sidebar with a search bar.  
* **Categories:** 1\. Planets, 2\. Moons, 3\. Stars, 4\. Star Remnants & Nebulae, 5\. Asteroids, 6\. Satellites.  
* **Entity Properties Panel:** A fixed UI overlay. On click, populate with real-time REBOUND data (Mass, Velocity vector, LOD state).  
* **Hover Cards:** Hover-state "Info Cards" displaying real-world Mass, Radius, and a 2-sentence description.

**5\. Interaction & Time Logic:**

* **Granular Slow-Motion Time Slider:** Implement a UI slider clamped exclusively between 0 and 1\.  
  * 0 \= Paused.  
  * 0.01 \= 100x slower.  
  * 0.1 \= 10x slower.  
  * 1 \= Real-time.  
  * *Strict Rule:* It must NEVER exceed 1 (No fast-forward).  
  * *Pause Behavior:* When paused (0), the scene MUST continue to render. Camera movement, dragging, selection, and UI updates must function normally, but REBOUND physics dt must not advance.  
* **Dynamic Scaling:** UI slider to dynamically adjust scale/mass. If a Star's mass exceeds limits, trigger a procedural Supernova particle effect and replace with a Star Remnant.

**6\. Procedural Shaders (No Models Needed for These):**

* **Stars:** Procedurally generate using emissive Three.js materials and bloom based on temperature.  
* **Nebulae (Randomized):** Use a volumetric THREE.ShaderMaterial with GLSL 3D Noise. Every instance should have randomized vibrant color uniforms so no two nebulas look the same.  
* **Black Holes:** Use Custom GLSL Shaders for Gravitational Lensing (space warping).

**Execution Plan (Strict Staged Delivery):**

Do not write the whole app at once. Stop and wait for my approval after each step:

1. **Scaffolding & Time:** Build the Initial Loading Screen, the Three.js scene, starfield, and the REBOUND loop integrated with the **Strict Slow-Mo Time Slider**. Ensure pause allows camera movement. (STOP AND WAIT)  
2. **LOD & Loader:** Connect the Loading Screen to the ModelLoader (reading from 3D models/ with nested support) featuring the Fallback Chain, Miss-Caching, and the Priority-based SpaceLODManager. (STOP AND WAIT)  
3. **UI & Raycasting:** Build the Sidebar, Drag-and-Drop, Hover priorities, and the Click-to-Select Raycaster that updates the Properties Panel. (STOP AND WAIT)  
4. **Shaders & FX:** Implement the GLSL Black Hole, randomized Nebulae, and Star bloom.

---

## 7. Clarifications, Bug Fixes & Additional Requirements (REVIEW ADDENDUM)

The original brief above is canonical. The items below resolve gaps, ambiguities, and asset-level bugs discovered during review. Treat each subsection as binding alongside the original requirement it amends.

### 7.1 Physics Engine — REBOUND Reality Check (CRITICAL)

There is no maintained `rebound.js` / Wasm package on npm. Two acceptable paths:

**Option A (preferred if you can produce it):** Compile `librebound` (C source from `hannorein/rebound`) to Wasm via Emscripten, exposing `IAS15` and `WHFAST` integrators. Ship the `.wasm` + JS glue from `/lib/rebound/`. Document the build command in `README.md`.

**Option B (fallback, ship-able today):** Implement a JS N-body integrator using **Velocity-Verlet** for stability with up to ~50 bodies at 60 fps. Use SI units internally (kg, m, s); apply `DISTANCE_SCALE` only at render time. Gravitational softening epsilon = 1e3 m to prevent singularities on close approach.

Whichever path is chosen, the engine **must** expose: `addBody({mass, position, velocity})`, `removeBody(id)`, `step(dt_seconds)`, `getState(id) -> {position, velocity}`. The rest of the app must depend only on this interface so the engine is swappable.

### 7.2 Asset Bugs — Required Loader Behavior

The on-disk names in `3D models/` have inconsistencies that the loader **must** normalize before lookup:

- **Ganymede misspellings:** Map both `ganymede` requests to try `ganimedes_4k.glb` then `ganymade_1k.glb` (do not rename files on disk; fix in the loader). Add an `ALIAS_MAP` constant in the loader.
- **Case-insensitive lookup:** Normalize requested name and on-disk filename to lowercase before comparison. Required for `Io_4k.glb` vs `io_1k.glb` and `The_Moon_*.glb`.
- **Satellites have no `_1k`/`_4k` suffix:** `iss.glb`, `hubble_space_telescope.glb`, `james_webb_space_telescope.glb`, `voyager_1.glb`, `sputnik_1.glb`. The existing fallback chain `[name]_4k → [name]_1k → [name].glb` already covers this — do not skip the final fallback step.
- **Miss-cache must persist for the session:** Cache 404s in a `Set<string>` so repeated LOD upgrade attempts on, e.g., `vesta_4k.glb` (which does not exist) issue **zero** additional network requests.
- **Atomic LOD swap:** When upgrading, the new mesh must be loaded fully and added to the scene **before** the old mesh is removed and disposed. No single-frame gap where the object disappears.
- **Texture & geometry disposal:** On LOD downgrade or body removal, call `mesh.geometry.dispose()` and `traverse` materials to dispose every texture. Verify with `renderer.info.memory.textures` not growing across thrash cycles.

### 7.3 Body Manifest (REQUIRED — currently missing)

Build the sidebar from this manifest. Each entry: `{ id, displayName, category, assetName, realMass_kg, realRadius_m, description, defaultColor }`. `assetName` is the loader key (without `_1k`/`_4k`); the loader resolves files. `defaultColor` is the procedural-sphere fallback color.

| Category | Bodies (assetName) |
|---|---|
| Planets | mercury, venus, earth, mars, jupiter, saturn, uranus, neptune |
| Moons | the_moon (Earth), phobos (Mars), io/europa/ganymede (alias!)/titan/enceladus (Jupiter+Saturn), triton (Neptune) |
| Stars | sun (procedural; no GLB), sirius_a, betelgeuse, proxima_centauri (all procedural; differ by `temperature_K` uniform driving emissive color) |
| Star Remnants & Nebulae | crab_nebula, orion_nebula, ring_nebula, neutron_star, white_dwarf, black_hole_stellar, black_hole_supermassive (all procedural) |
| Asteroids | vesta, bennu (1k only — fallback chain handles 4k miss) |
| Satellites | iss, hubble_space_telescope, james_webb_space_telescope, voyager_1, sputnik_1 |

Persist this manifest as `src/data/bodies.json` and load once at boot.

### 7.4 Time Slider — Base Scale & Pause Semantics

- **Base scale (define explicitly):** Slider value `1.0` = **1 simulated day per real second** (86400× wallclock). This makes a year visible in ~6 minutes. The strict slider rule (≤ 1.0) still holds.
  - `0.01` = 100× slower than 1 day/sec = ~864 sec/sec ≈ 14× wallclock.
  - `0.0` = paused.
- **Sub-stepping:** Internal physics step `dt_phys` = 60 sec when slider = 1.0. At lower slider values, take fewer/smaller steps but **never** more than 8 sub-steps per frame to protect 60 fps.
- **Pause + drag:** During pause, dragging a body **must** update its REBOUND state immediately on drop (call `engine.setState(id, …)`); otherwise the drop appears to "do nothing" until unpause.

### 7.5 Camera Controls

- Use Three.js `OrbitControls` with `enableDamping = true`, `dampingFactor = 0.08`.
- **Logarithmic depth buffer** (`renderer = new WebGLRenderer({ logarithmicDepthBuffer: true })`) — required to avoid z-fighting when both the Sun (radius ~7e8 m) and the ISS (~100 m) are in the scene at once with a unified `DISTANCE_SCALE`.
- Zoom range: min distance = 1 unit (close-up of any body), max distance = 5000 units (system-wide overview).
- **Double-click any body to focus:** smoothly `lerp` camera target to that body's position over 600 ms; subsequent orbit pivots around it. Pressing `ESC` clears focus and returns target to origin.

### 7.6 Drag-and-Drop Spawn Rules

When a sidebar item is dropped onto the canvas:

1. Cast a ray from the drop screen-coords. Intersect with an invisible plane through the **camera target**, perpendicular to the camera forward vector. The hit point is the spawn position.
2. **Initial velocity:** If a massive body (mass > 1e22 kg) exists within 50 units of the spawn, give the new body a circular-orbit velocity around the nearest such body (`v = sqrt(G * M / r)`, perpendicular to the radial vector, in the camera's up-projected plane). Otherwise spawn at rest.
3. **Initial mass:** Use the manifest's `realMass_kg`. Apply the global mass multiplier (see §7.7) at spawn.
4. **Spawn preview:** While dragging over the canvas, render a translucent ghost sphere at the projected spawn point so the user sees where it will land before releasing.
5. **Touch fallback:** On touch devices (no `pointermove` while pressed without contact), use **tap-to-add**: tap a sidebar item to "arm", then tap canvas to spawn.

### 7.7 Mass / Scale Slider Scope

- Two separate sliders (originally conflated in §5):
  - **Visual Size Multiplier** (global, 0.1× – 100×): affects only `mesh.scale`. Does not change physics.
  - **Mass Multiplier** (per-selected-body, 0.01× – 1000×): scales `body.mass` in the engine. Disabled when no body selected.
- **Supernova threshold:** Stars with `mass > 8 × M_sun` after multiplier triggers supernova. Show a confirmation dialog ("This will destroy [Star Name]. Continue?") **only if** the star is currently selected; otherwise trigger automatically. Replacement remnant: white dwarf (≤ 1.4 M☉ post-loss), neutron star (1.4–3 M☉), or stellar black hole (> 3 M☉).

### 7.8 Selection / Hover Rules

- **Click empty space:** deselect.
- **Click UI panel:** does not deselect (use `event.stopPropagation` on the panel root).
- **ESC:** deselects and clears double-click focus.
- **Selected body remains High-Res** even when off-screen, consuming 1 of 3 LOD budget slots.
- **Hover state expires** 200 ms after `pointerleave` (debounced) to prevent thrash on quick mouse movement; during the 200 ms grace the body keeps its High-Res slot.
- **Hover card:** anchored next to the cursor, offset (16, 16) px, clamped to viewport edges. Debounce show by 120 ms. Hidden on touch devices.

### 7.9 LOD Visibility Test

"Closest visible objects" = bodies whose **bounding sphere intersects the camera frustum** (use `THREE.Frustum.intersectsSphere`). Compute frustum once per frame, not per body. Distance metric for ranking = camera-to-body-center.

### 7.10 Loading Screen — Wasm Progress

Three.js `LoadingManager` does not observe raw `fetch()` of the Wasm binary. Wrap the Wasm fetch:

```js
async function fetchWasmWithProgress(url, onProgress) {
  const res = await fetch(url);
  const total = +res.headers.get('content-length');
  const reader = res.body.getReader();
  let received = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); received += value.length;
    onProgress(received / total);
  }
  return new Blob(chunks).arrayBuffer();
}
```

Combine: total progress = 0.5 × (Wasm fraction) + 0.5 × (LoadingManager fraction). Show error UI ("Failed to load physics engine — check connection and reload") on Wasm fetch failure; don't leave the bar stuck.

### 7.11 Selective Bloom

`UnrealBloomPass` applied globally will halo the planets nearest a bright star. Use Three.js **layer-based selective bloom**:

1. Stars and supernova particles on `layer 1`.
2. Render layer 1 → bloom pass → write to a render target.
3. Render layer 0 (everything else) normally.
4. Additive-blend the bloom target on top.

Reference: Three.js example `webgl_postprocessing_unreal_bloom_selective`.

### 7.12 Procedural Overlays (originally missing)

- **Saturn:** add a procedural ring system as a flat `RingGeometry` with a custom shader (radial color bands + alpha falloff). Rotate with planet axial tilt (26.7°).
- **Earth:** add a translucent cloud sphere (1.01× radius) using a free seamless cloud texture or procedural fbm; rotate independently 1.5× faster than the planet.
- **Gas giants:** subtle latitudinal banding via a fragment shader if a 4K texture is missing.

### 7.13 Persistence & Reset

- **Reset button** in the UI: clears all bodies, restores camera to default, sets time slider to 1.0.
- **Presets dropdown:** "Empty", "Solar System (full)", "Inner Planets only", "Jupiter system" — instantiate from the manifest.
- **Auto-save sandbox to `localStorage`** every 5 seconds (debounced); restore on reload with a "Restore previous session?" prompt. Serialize: list of body ids + their `{mass, position, velocity, mass_multiplier}`.

### 7.14 Error & Edge-Case UI

- **Asset 404 (after full fallback chain):** show a one-time toast: "Couldn't load model for [name] — using placeholder sphere." Do not block other loads.
- **WebGL2 not available:** show a full-screen message and exit gracefully.
- **Touch-only device:** show a banner explaining hover cards are disabled and tap-to-spawn is active.

### 7.15 Performance Budgets (acceptance criteria)

- **60 fps** sustained with: 30 bodies, 3 high-res LOD, bloom + lensing active, on a mid-tier integrated GPU (Iris Xe class).
- **40 fps** floor with 50 bodies + black hole lensing.
- Physics step time < 4 ms/frame at 30 bodies.
- GPU texture memory < 512 MB sustained (verify with `renderer.info.memory`).

### 7.16 Spec Coverage Checklist (run before each STOP/WAIT gate)

- [ ] Loading screen never hangs (Wasm error path tested by blocking the request)
- [ ] Pause holds physics but renders camera/drag/UI
- [ ] LOD never flickers (test by orbiting at exactly 175 units — within hysteresis band)
- [ ] All 6 categories populated from manifest, search filters across all
- [ ] Drag-and-drop ghost preview visible; orbital velocity feels right
- [ ] Mass slider triggers supernova at 8 M☉; correct remnant chosen
- [ ] Selective bloom does not halo planets near the Sun
- [ ] Memory does not grow over 5 minutes of LOD thrashing