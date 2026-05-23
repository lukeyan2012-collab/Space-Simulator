import { Layers, MeshBasicMaterial, ShaderMaterial, Vector2, Vector3 } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';

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
  // Bloom params: (resolution, strength, radius, threshold). Strength dropped from 1.4 to
  // make the suns less overpowering. Half-res target keeps the GPU load modest.
  const bloomRes = new Vector2(Math.max(64, size.x * 0.5), Math.max(64, size.y * 0.5));
  bloomComposer.addPass(new UnrealBloomPass(bloomRes, 0.75, 0.45, 0.0));

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

  // Selection outline. We keep selectedObjects empty by default; main.js fills it on
  // click. Runs after the bloom mix so the outline sits on top of the glow.
  // Values tuned high so the silhouette stays clearly visible at any zoom — focused
  // body should always be obvious.
  const outlinePass = new OutlinePass(new Vector2(size.x, size.y), scene, camera);
  outlinePass.edgeStrength = 10.0;
  outlinePass.edgeGlow = 1.0;
  outlinePass.edgeThickness = 3.0;
  outlinePass.pulsePeriod = 0.0;
  outlinePass.visibleEdgeColor.set('#ffd24a');
  // hiddenEdgeColor makes the outline still draw a faint trace where the body is
  // occluded — keeps the highlight present even if something briefly passes in front.
  outlinePass.hiddenEdgeColor.set('#8a6b1f');
  finalComposer.addPass(outlinePass);

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
    outlinePass.setSize(w, h);
  }

  function setOutlineSelection(objects) {
    outlinePass.selectedObjects = objects || [];
  }

  return { render, setSize, setOutlineSelection, outlinePass };
}
