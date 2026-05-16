import { ShaderMaterial, Color } from 'three';

// Approximate sRGB color from a blackbody temperature in Kelvin (Tanner Helland's algorithm).
// Returns a Three.js Color whose components are in [0,1].
export function blackbodyColor(K) {
  K = Math.max(1000, Math.min(40000, K)) / 100;
  let r, g, b;
  if (K <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(K) - 161.1195681661;
  } else {
    r = 329.698727446 * Math.pow(K - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(K - 60, -0.0755148492);
  }
  if (K >= 66)      b = 255;
  else if (K <= 19) b = 0;
  else              b = 138.5177312231 * Math.log(K - 10) - 305.0447927307;
  const c = (x) => Math.max(0, Math.min(255, x)) / 255;
  return new Color(c(r), c(g), c(b));
}

// Self-lit (emissive) star material. The sphere appears to glow from within with a temperature-
// tinted color and subtle limb darkening + flicker. Designed to live on the bloom render layer
// so the selective-bloom pass haloes it.
export function createStarMaterial({ temperature_K = 5778 } = {}) {
  const color = blackbodyColor(temperature_K);
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: color },
      uTemp:  { value: temperature_K },
      uTime:  { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vN;
      varying vec3 vP;
      void main() {
        vN = normalize(normalMatrix * normal);
        vP = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uTime;
      varying vec3 vN;
      varying vec3 vP;
      void main() {
        // Limb darkening: fragments whose normal is perpendicular to the view get dimmer.
        float fresnel = pow(1.0 - abs(dot(vN, vec3(0.0, 0.0, 1.0))), 1.8);
        // Subtle low-frequency flicker — purely cosmetic.
        float flicker = 0.95 + 0.05 * sin(uTime * 1.4 + vP.x * 0.4 + vP.y * 0.7);
        // Dimmer than before (was 1.35 - 0.4*fresnel); the selective-bloom pass adds the glow.
        vec3 col = uColor * (0.78 - 0.30 * fresnel) * flicker;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}
