import { PlaneGeometry, Mesh, ShaderMaterial, DoubleSide, Color } from 'three';

// Cap on bodies the shader will sum potential from. Beyond this, extra bodies are ignored.
const MAX_BODIES = 64;
const SIZE = 4000;       // edge length in scene units; covers the demo orbit (Earth ~150)
const SEGMENTS = 200;    // grid resolution; higher = smoother warp, more verts to displace

// A single horizontal plane that renders either as a flat grid or a gravitationally-warped grid.
// "Gravity" is a heuristic visualization, not real GR: vertex Y is displaced by Σ log(mass)/dist
// from each body, with a softening term so we don't dive to -∞ at body centers.
export function createSpacetimeGrid() {
  const geom = new PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
  geom.rotateX(-Math.PI / 2); // flat in XZ plane (the ecliptic — same plane Earth orbits in)

  const positions = new Float32Array(MAX_BODIES * 3);
  const masses = new Float32Array(MAX_BODIES);

  const material = new ShaderMaterial({
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    uniforms: {
      uWarpAmount:    { value: 0 },                          // 0 = flat grid, 1 = warped
      uBodyCount:     { value: 0 },
      uBodyPositions: { value: positions },
      uBodyMasses:    { value: masses },                     // pre-normalized: log10(1 + m/1e22) * 0.5
      uGridSpacing:   { value: 25 },                         // scene units between gridlines
      uGridColor:     { value: new Color(0x4488cc) },
      uWarpScale:     { value: 8.0 },                        // depth multiplier
      uSoftening:     { value: 6.0 },                        // distance softening to prevent r→0 spike
    },
    vertexShader: /* glsl */`
      uniform float uWarpAmount;
      uniform int uBodyCount;
      uniform vec3 uBodyPositions[${MAX_BODIES}];
      uniform float uBodyMasses[${MAX_BODIES}];
      uniform float uWarpScale;
      uniform float uSoftening;

      varying vec3 vWorldPos;
      varying float vDepth;

      void main() {
        vec3 pos = position;
        float depth = 0.0;
        if (uWarpAmount > 0.0) {
          for (int i = 0; i < ${MAX_BODIES}; i++) {
            if (i >= uBodyCount) break;
            vec2 dxz = pos.xz - uBodyPositions[i].xz;
            float r2 = dot(dxz, dxz) + uSoftening * uSoftening;
            depth += uBodyMasses[i] / sqrt(r2);
          }
          pos.y -= depth * uWarpScale * uWarpAmount;
        }
        vDepth = depth * uWarpScale;
        vec4 world = modelMatrix * vec4(pos, 1.0);
        vWorldPos = world.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uGridSpacing;
      uniform vec3 uGridColor;
      uniform float uWarpAmount;
      varying vec3 vWorldPos;
      varying float vDepth;

      void main() {
        // anti-aliased gridlines on world XZ
        vec2 g = abs(fract(vWorldPos.xz / uGridSpacing - 0.5) - 0.5) * uGridSpacing;
        float lineDist = min(g.x, g.y);
        float fw = max(fwidth(lineDist), 0.0001);
        float line = 1.0 - smoothstep(0.0, fw * 1.5, lineDist);

        // fade gridlines toward the edges so the plane doesn't look hard-cut
        float distFromOrigin = length(vWorldPos.xz);
        float fade = 1.0 - smoothstep(800.0, 1900.0, distFromOrigin);

        // tint deeper warps a darker blue
        float depthFactor = clamp(vDepth / 25.0, 0.0, 1.0);
        vec3 col = mix(uGridColor, uGridColor * 0.4 + vec3(0.05, 0.05, 0.25), depthFactor * uWarpAmount);

        float alpha = line * fade * 0.65;
        if (alpha < 0.005) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const mesh = new Mesh(geom, material);
  mesh.frustumCulled = false;
  mesh.visible = false;

  function setMode(mode) {
    if (mode === 'grid') { mesh.visible = true; material.uniforms.uWarpAmount.value = 0; }
    else if (mode === 'warp') { mesh.visible = true; material.uniforms.uWarpAmount.value = 1; }
    else { mesh.visible = false; }
  }

  function updateBodies(records) {
    const count = Math.min(records.length, MAX_BODIES);
    for (let i = 0; i < count; i++) {
      const r = records[i];
      const p = r.object.position;
      positions[i * 3 + 0] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      // log-scaled mass so the Sun doesn't dwarf everything else into invisibility
      const m = r.body?.realMass_kg ?? 0;
      masses[i] = m > 0 ? Math.log10(1 + m / 1e22) * 0.5 : 0;
    }
    for (let i = count; i < MAX_BODIES; i++) {
      positions[i * 3 + 0] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      masses[i] = 0;
    }
    material.uniforms.uBodyCount.value = count;
    // The flat array is shared with the uniform; mark for upload
    material.uniformsNeedUpdate = true;
  }

  return { mesh, setMode, updateBodies };
}
