import { ShaderMaterial, Color, AdditiveBlending, DoubleSide } from 'three';

const NOISE3D = /* glsl */`
  float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float n3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i + vec3(0,0,0)), hash3(i + vec3(1,0,0)), f.x),
          mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
          mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }
  float fbm3(vec3 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 6; i++) { s += a * n3(p); p *= 2.05; a *= 0.5; }
    return s;
  }
`;

// Generate a vibrant color (high saturation, mid-bright lightness). Stays away from gray.
function vibrant() {
  return new Color().setHSL(Math.random(), 0.92 + Math.random() * 0.08, 0.55 + Math.random() * 0.12);
}

// Three-color volumetric nebula. Two fBm fields blend three vibrant colors. The volumetric
// look comes from a view-space-normal falloff (`abs(vN.z)`) — the fragment is most opaque
// where the surface faces the camera and softly fades at the silhouette. Rendered DoubleSide
// + additive so both faces of the sphere contribute, doubling the color in the middle.
//
// (Previous version tried `length(vP)` for the falloff, but `position` is always on the unit
// sphere → length(vP) == 1 → alpha collapsed to zero and you couldn't see anything.)
export function createNebulaMaterial() {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    uniforms: {
      uTime:   { value: 0 },
      uColorA: { value: vibrant() },
      uColorB: { value: vibrant() },
      uColorC: { value: vibrant() },
      uSeed:   { value: Math.random() * 100 },
    },
    vertexShader: /* glsl */`
      varying vec3 vP;
      varying vec3 vN;
      void main() {
        vP = position;
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform vec3 uColorA, uColorB, uColorC;
      uniform float uSeed;
      varying vec3 vP;
      varying vec3 vN;
      ${NOISE3D}
      void main() {
        vec3 p = vP * 1.6 + vec3(uSeed);
        float d  = fbm3(p + vec3(0.0, uTime * 0.025, 0.0));            // density field
        float t1 = fbm3(p * 1.8 + vec3(uSeed * 0.1, 0.0, 0.0));        // color blend A↔B
        float t2 = fbm3(p * 2.4 + vec3(0.0, uSeed * 0.3, uSeed * 0.7));// color blend → C

        // View-space normal Z = "how front-facing" the fragment is. ~1 near the projected
        // center of the disk, ~0 at the silhouette. Gives a soft 3D-cloud edge.
        float facing = abs(vN.z);
        float radial = smoothstep(0.0, 0.9, facing);

        float a = smoothstep(0.22, 0.75, d) * radial;
        if (a < 0.005) discard;
        vec3 col = mix(mix(uColorA, uColorB, t1), uColorC, t2 * 0.65);
        gl_FragColor = vec4(col * 1.6, a * 0.95);
      }
    `,
  });
}
