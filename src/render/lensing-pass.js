import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Vector2 } from 'three';

// Up to 2 black holes considered for lensing (limit per shader).
const MAX_HOLES = 2;

const LensingShader = {
  uniforms: {
    tDiffuse:   { value: null },
    uHoles:     { value: Array.from({ length: MAX_HOLES }, () => new Vector2(-9, -9)) },
    uStrengths: { value: new Float32Array(MAX_HOLES) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2 uHoles[${MAX_HOLES}];
    uniform float uStrengths[${MAX_HOLES}];
    varying vec2 vUv;
    void main() {
      vec2 uv = vUv;
      for (int i = 0; i < ${MAX_HOLES}; i++) {
        if (uStrengths[i] <= 0.0) continue;
        vec2 d = uv - uHoles[i];
        float r = length(d);
        if (r < 0.001) continue;
        // Bend uv inward toward the hole — fake gravitational lensing.
        float bend = uStrengths[i] / (r * r + 0.02);
        uv -= normalize(d) * bend;
      }
      gl_FragColor = texture2D(tDiffuse, uv);
    }
  `,
};

// Lensing screen-space pass driven by current black-hole positions.
// Pass `pass` into an EffectComposer; call `update()` each frame so the uniforms reflect
// the current camera view.
export function createLensingPass({ camera, getBlackHoles }) {
  const pass = new ShaderPass(LensingShader);

  function update() {
    const holes = (getBlackHoles?.() ?? []).slice(0, MAX_HOLES);
    for (let i = 0; i < MAX_HOLES; i++) {
      if (i < holes.length) {
        const h = holes[i];
        const ndc = h.object.position.clone().project(camera);
        if (ndc.z < 1) {
          pass.material.uniforms.uHoles.value[i].set((ndc.x + 1) * 0.5, (ndc.y + 1) * 0.5);
          const r = h.object.scale?.x || 1;
          // Strength scales with the body's world radius; clamped so a giant SMBH doesn't
          // turn the screen into a black blob.
          pass.material.uniforms.uStrengths.value[i] = Math.min(0.07, 0.0015 * r);
        } else {
          pass.material.uniforms.uStrengths.value[i] = 0;
        }
      } else {
        pass.material.uniforms.uStrengths.value[i] = 0;
      }
    }
  }

  return { pass, update };
}
