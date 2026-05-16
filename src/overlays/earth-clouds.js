import { Mesh, SphereGeometry, ShaderMaterial } from 'three';

const NOISE2D = /* glsl */`
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5); }
  float n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i),            h(i + vec2(1,0)), f.x),
               mix(h(i + vec2(0,1)), h(i + vec2(1,1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 5; i++) { s += a * n(p); p *= 2.05; a *= 0.5; }
    return s;
  }
`;

// Attach a translucent cloud sphere as a child of Earth's mesh. Geometry radius is 1.02 in
// unit-relative coords, so when scaled by the parent it sits just above the surface.
// The cloud sphere uTime is incremented by main.js each frame so the patterns drift slowly.
export function attachEarthClouds(parent) {
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      varying vec2 vUv;
      ${NOISE2D}
      void main() {
        float c = fbm(vec2(vUv.x * 6.0 + uTime * 0.012, vUv.y * 3.0));
        float a = smoothstep(0.55, 0.85, c);
        if (a < 0.02) discard;
        gl_FragColor = vec4(1.0, 1.0, 1.0, a * 0.55);
      }
    `,
  });
  const cloud = new Mesh(new SphereGeometry(1.02, 64, 64), mat);
  parent.add(cloud);
  return cloud;
}
