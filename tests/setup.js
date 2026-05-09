// tests/setup.js — jsdom doesn't provide WebGL; stub the bare minimum so Three.js constructor succeeds.
import { beforeAll } from 'vitest';

beforeAll(() => {
  if (typeof HTMLCanvasElement === 'undefined') return;
  HTMLCanvasElement.prototype.getContext = function (type) {
    if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') {
      // Create a comprehensive WebGL stub for Three.js
      const glStub = {
        canvas: this,
        getParameter(param) {
          // Return version strings for string parameters
          if (param === 37445) return 'WebGL 2.0'; // VERSION
          if (param === 37446) return 'WebGL GLSL ES 3.00'; // SHADING_LANGUAGE_VERSION
          return 0;
        },
        getExtension: () => null,
        getShaderPrecisionFormat: () => ({ rangeMin: 1, rangeMax: 1, precision: 1 }),
        getContextAttributes: () => ({ antialias: true, depth: true, stencil: false }),
        isContextLost: () => false,
        getError: () => 0,
        deleteShader: () => {},
        deleteProgram: () => {},
        detachShader: () => {},
        deleteBuffer: () => {},
        deleteTexture: () => {},
        deleteFramebuffer: () => {},
        deleteRenderbuffer: () => {},
        deleteVertexArray: () => {},
      };
      return glStub;
    }
    return null;
  };
});
