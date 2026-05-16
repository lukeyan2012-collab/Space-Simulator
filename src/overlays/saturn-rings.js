import { Mesh, RingGeometry, ShaderMaterial, DoubleSide, Color, MathUtils } from 'three';

// Attach a procedural ring system as a child of Saturn's mesh. Geometry is in unit-relative
// coordinates (inner=1.2, outer=2.3), so it inherits the parent's scale and ends up at
// planet_radius * 1.2..2.3 in world units. Rotated to lie in Saturn's equatorial plane with
// the famous 26.7° axial tilt.
export function attachSaturnRings(parent) {
  const inner = 1.2;
  const outer = 2.3;
  const geom = new RingGeometry(inner, outer, 128);
  // RingGeometry's default UVs aren't useful for radial banding. Remap so u runs from inner
  // edge (0) to outer edge (1) and v is unused.
  const uv = geom.attributes.uv;
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, (r - inner) / (outer - inner), 0);
  }

  const mat = new ShaderMaterial({
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    uniforms: {
      uColor: { value: new Color(0xd6c08a) },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      varying vec2 vUv;
      // Procedurally banded alpha: multiple high-frequency sines + an edge falloff.
      float bands(float u) {
        float b = 0.6 + 0.4 * sin(u * 42.0) * sin(u * 17.0);
        b *= smoothstep(0.0, 0.05, u) * smoothstep(1.0, 0.7, u);
        return b;
      }
      void main() {
        float a = bands(vUv.x);
        if (a < 0.02) discard;
        gl_FragColor = vec4(uColor, a);
      }
    `,
  });

  const ring = new Mesh(geom, mat);
  ring.rotation.x = Math.PI / 2; // RingGeometry is built in XY; rotate to lie flat in XZ
  ring.rotation.z = MathUtils.degToRad(26.7);
  parent.add(ring);
  return ring;
}
