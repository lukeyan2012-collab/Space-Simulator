import { Layers, MeshBasicMaterial, ShaderMaterial, Vector2 } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Render layer reserved for bloom-emitting objects (stars, supernova FX). Anything else gets
// darkened to black before the bloom pass so its colors don't bleed into the glow.
export const BLOOM_LAYER = 1;

const DARK = new MeshBasicMaterial({ color: 0x000000 });

// Two-pass selective bloom:
//   1. Darken non-bloom objects to black, render to off-screen target, run UnrealBloomPass.
//   2. Render the full scene normally and additively mix the bloom target on top.
// Optional `extraPass` is appended after the mix (used by main.js for the lensing pass).
export function createSelectiveBloom({ renderer, scene, camera, extraPass = null } = {}) {
  const size = renderer.getSize(new Vector2());
  const bloomLayer = new Layers();
  bloomLayer.set(BLOOM_LAYER);

  const bloomComposer = new EffectComposer(renderer);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(new RenderPass(scene, camera));
  bloomComposer.addPass(new UnrealBloomPass(size, 1.4, 0.5, 0.0));

  const finalShader = {
    uniforms: {
      baseTexture:  { value: null },
      bloomTexture: { value: bloomComposer.renderTarget2.texture },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D baseTexture;
      uniform sampler2D bloomTexture;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv);
      }
    `,
  };
  const mixPass = new ShaderPass(new ShaderMaterial(finalShader), 'baseTexture');

  const finalComposer = new EffectComposer(renderer);
  finalComposer.addPass(new RenderPass(scene, camera));
  finalComposer.addPass(mixPass);
  if (extraPass) finalComposer.addPass(extraPass);

  const cached = new Map();
  function darkenNonBloom(obj) {
    if (obj.isMesh && !bloomLayer.test(obj.layers)) {
      cached.set(obj.uuid, obj.material);
      obj.material = DARK;
    }
  }
  function restore(obj) {
    if (cached.has(obj.uuid)) {
      obj.material = cached.get(obj.uuid);
      cached.delete(obj.uuid);
    }
  }

  function render() {
    scene.traverse(darkenNonBloom);
    bloomComposer.render();
    scene.traverse(restore);
    finalComposer.render();
  }

  function setSize(w, h) {
    bloomComposer.setSize(w, h);
    finalComposer.setSize(w, h);
  }

  return { render, setSize };
}
