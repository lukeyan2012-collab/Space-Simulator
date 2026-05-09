import { Color, MeshStandardMaterial } from 'three';

// KHR_materials_pbrSpecularGlossiness was removed from three.js core in r150.
// Many older Sketchfab exports (and other authoring tools) still emit it as a REQUIRED extension,
// causing GLTFLoader to abort with "Unknown extension" if no handler is registered.
//
// This shim approximates SpecGloss → MetallicRoughness so the geometry + diffuse texture load.
// Specular tint and glossiness map fidelity are lost, but for planet/asteroid surfaces the
// diffuse map dominates the visual, so the approximation is acceptable.
//
// Register on a GLTFLoader instance once at construction:
//   const loader = new GLTFLoader();
//   registerSpecGlossExtension(loader);
const NAME = 'KHR_materials_pbrSpecularGlossiness';

export function registerSpecGlossExtension(loader) {
  loader.register((parser) => ({
    name: NAME,

    getMaterialType(materialIndex) {
      const def = parser.json.materials?.[materialIndex];
      if (!def?.extensions?.[NAME]) return null;
      return MeshStandardMaterial;
    },

    extendMaterialParams(materialIndex, materialParams) {
      const def = parser.json.materials?.[materialIndex];
      const sg = def?.extensions?.[NAME];
      if (!sg) return Promise.resolve();

      const pending = [];

      materialParams.color = new Color(1, 1, 1);
      materialParams.opacity = 1;
      if (Array.isArray(sg.diffuseFactor)) {
        materialParams.color.fromArray(sg.diffuseFactor);
        if (sg.diffuseFactor.length > 3) materialParams.opacity = sg.diffuseFactor[3];
      }
      if (sg.diffuseTexture) {
        pending.push(parser.assignTexture(materialParams, 'map', sg.diffuseTexture));
      }

      materialParams.metalness = 0;
      materialParams.roughness = sg.glossinessFactor != null ? 1 - sg.glossinessFactor : 0.5;
      if (sg.specularGlossinessTexture) {
        // alpha channel is glossiness; we use the texture as a roughness map (an approximation)
        pending.push(parser.assignTexture(materialParams, 'roughnessMap', sg.specularGlossinessTexture));
      }

      return Promise.all(pending);
    },
  }));
}
