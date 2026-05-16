import { ShaderMaterial, Color, AdditiveBlending } from 'three';

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
    for (int i = 0; i < 5; i++) { s += a * n3(p); p *= 2.05; a *= 0.5; }
    return s;
  }
`;

// Generate a vibrant color (high saturation, mid lightness). Stays out of muddy gray territory.
function vibrant() {
  return new Color().setHSL(Math.random(), 0.9 + Math.random() * 0.1, 0.5 + Math.random() * 0.12);
}

// Three-color volumetric nebula. Two fBm fields blend three vibrant colors, so each instance is
// a unique mix and the result rarely looks two-tone. Additive blending so overlapping clouds
// layer their colors together.
export function createNebulaMaterial() {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
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
      void main() {
        vP = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform vec3 uColorA, uColorB, uColorC;
      uniform float uSeed;
      varying vec3 vP;
      ${NOISE3D}
      void main() {
        vec3 p = vP * 1.2 + vec3(uSeed);
        float d  = fbm3(p + vec3(0.0, uTime * 0.03, 0.0));   // overall density
        float t1 = fbm3(p * 1.7 + vec3(uSeed * 0.1));        // first color blend
        float t2 = fbm3(p * 2.3 + vec3(0.0, 0.0, uSeed));    // second color blend
        float a  = smoothstep(0.38, 0.85, d);
        vec3 col = mix(mix(uColorA, uColorB, t1), uColorC, t2 * 0.6);
        gl_FragColor = vec4(col * 1.15, a * 0.7);
      }
    `,
  });
}
