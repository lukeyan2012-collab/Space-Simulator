import {
  Mesh, SphereGeometry, ShaderMaterial, BackSide, AdditiveBlending, Color,
} from 'three';

// A back-faced, additively-blended sphere with a Fresnel-rim shader. Placed just outside the
// selected body and scaled to ~1.15× its rendered radius, it produces a glowing aura at the
// silhouette without obscuring the body itself. A faint pulse modulates intensity over time.
export function createSelectionHalo({ color = 0xffee33 } = {}) {
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: BackSide,
    blending: AdditiveBlending,
    uniforms: {
      uColor: { value: new Color(color) },
      uTime:  { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-viewPos.xyz);
        gl_Position = projectionMatrix * viewPos;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float rim = 1.0 - abs(dot(normalize(vNormal), normalize(vView)));
        rim = pow(rim, 1.6);
        float pulse = 0.85 + 0.15 * sin(uTime * 2.5);
        gl_FragColor = vec4(uColor * 1.4, rim * 0.7 * pulse);
      }`,
  });
  const mesh = new Mesh(new SphereGeometry(1, 32, 32), material);
  mesh.visible = false;
  mesh.renderOrder = 100;
  mesh.frustumCulled = false;
  return { mesh, material };
}
