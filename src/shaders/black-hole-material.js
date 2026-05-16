import { ShaderMaterial } from 'three';

// The event horizon is rendered as a pure-black opaque sphere. The visual "warping" around
// the hole comes from the screen-space lensing pass (src/render/lensing-pass.js).
export function createBlackHoleMaterial() {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
      void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */`
      void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }
    `,
  });
}
