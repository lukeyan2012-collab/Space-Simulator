// tests/setup.js — jsdom doesn't provide WebGL; stub the bare minimum so Three.js constructor succeeds.
import { beforeAll } from 'vitest';

beforeAll(() => {
  if (typeof HTMLCanvasElement === 'undefined') return;

  // Set WebGL context globals so Three.js instanceof checks work
  globalThis.WebGLRenderingContext = function () {};
  globalThis.WebGL2RenderingContext = function () {};

  const noop = () => {};

  HTMLCanvasElement.prototype.getContext = function (type) {
    if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') {
      // Create a comprehensive WebGL stub for Three.js
      const baseContext = {
        canvas: this,
        drawingBufferWidth: 800,
        drawingBufferHeight: 600,
        getParameter(param) {
          // WebGL 1.0 string constants — Three.js calls this expecting string for VERSION/SHADING_LANGUAGE_VERSION
          // Default to VERSION if param is undefined (Three.js might call getParameter() without args in some cases)
          if (param === undefined || param === 37445) { // VERSION (0x9245)
            return 'WebGL 2.0';
          } else if (param === 37446) { // SHADING_LANGUAGE_VERSION (0x9246)
            return 'WebGL GLSL ES 3.00';
          } else if (param === 3398) { // ALIASED_LINE_WIDTH_RANGE
            return new Float32Array([0.5, 100]);
          } else if (param === 3379) { // ALIASED_POINT_SIZE_RANGE
            return new Float32Array([1, 100]);
          } else if (param === 3414) { // MAX_VERTEX_ATTRIBS
            return 16;
          } else if (param === 35661) { // MAX_VARYING_VECTORS
            return 16;
          } else {
            // Default numeric return
            return 0;
          }
        },
        getExtension: () => null,
        getShaderPrecisionFormat: () => ({ rangeMin: 1, rangeMax: 1, precision: 1 }),
        getContextAttributes: () => ({ antialias: true, depth: true, stencil: false }),
        isContextLost: () => false,
        getError: () => 0,
        deleteShader: noop,
        deleteProgram: noop,
        detachShader: noop,
        deleteBuffer: noop,
        deleteTexture: noop,
        deleteFramebuffer: noop,
        deleteRenderbuffer: noop,
        deleteVertexArray: noop,
        createBuffer: () => ({}),
        createTexture: () => ({}),
        createProgram: () => ({}),
        createShader: () => ({}),
        bindBuffer: noop,
        bindTexture: noop,
        useProgram: noop,
        viewport: noop,
        clear: noop,
        clearColor: noop,
        clearDepth: noop,
        enable: noop,
        disable: noop,
      };

      // Add common WebGL methods that Three.js might call but we haven't explicitly defined
      const commonMethods = [
        'attachShader', 'blendFunc', 'blendFuncSeparate', 'bufferData', 'bufferSubData',
        'checkFramebufferStatus', 'compileShader', 'copyTexImage2D', 'copyTexSubImage2D',
        'createFramebuffer', 'createRenderbuffer', 'createVertexArray', 'cullFace',
        'depthFunc', 'depthMask', 'depthRange', 'drawArrays', 'drawArraysInstanced',
        'drawElements', 'drawElementsInstanced', 'drawRangeElements', 'enableVertexAttribArray',
        'disableVertexAttribArray', 'finish', 'flush', 'framebufferRenderbuffer', 'framebufferTexture2D',
        'frontFace', 'generateMipmap', 'getActiveAttrib', 'getActiveUniform', 'getAttribLocation',
        'getUniformLocation', 'getUniform', 'hint', 'isBuffer', 'isEnabled', 'isFramebuffer',
        'isProgram', 'isRenderbuffer', 'isShader', 'isTexture', 'isVertexArray', 'lineWidth',
        'linkProgram', 'pixelStorei', 'polygonOffset', 'readPixels', 'renderbufferStorage',
        'sampleCoverage', 'scissor', 'shaderSource', 'stencilFunc', 'stencilFuncSeparate',
        'stencilMask', 'stencilMaskSeparate', 'stencilOp', 'stencilOpSeparate', 'texImage2D',
        'texImage3D', 'texParameterf', 'texParameteri', 'texSubImage2D', 'texSubImage3D',
        'uniform1f', 'uniform1fv', 'uniform1i', 'uniform1iv', 'uniform2f', 'uniform2fv',
        'uniform2i', 'uniform2iv', 'uniform3f', 'uniform3fv', 'uniform3i', 'uniform3iv',
        'uniform4f', 'uniform4fv', 'uniform4i', 'uniform4iv', 'uniformMatrix2fv',
        'uniformMatrix3fv', 'uniformMatrix4fv', 'uniformMatrix3x2fv', 'uniformMatrix2x3fv',
        'uniformMatrix4x2fv', 'uniformMatrix2x4fv', 'uniformMatrix4x3fv', 'uniformMatrix3x4fv',
        'vertexAttrib1f', 'vertexAttrib1fv', 'vertexAttrib2f', 'vertexAttrib2fv', 'vertexAttrib3f',
        'vertexAttrib3fv', 'vertexAttrib4f', 'vertexAttrib4fv', 'vertexAttribIPointer',
        'vertexAttribPointer', 'vertexAttribDivisor',
      ];

      commonMethods.forEach((method) => {
        if (!(method in baseContext)) {
          baseContext[method] = noop;
        }
      });

      // Add additional methods that Three.js might call
      baseContext.clearStencil = noop;
      baseContext.colorMask = noop;
      baseContext.compileShader = noop;
      baseContext.createFramebuffer = () => ({});
      baseContext.createRenderbuffer = () => ({});
      baseContext.createVertexArray = () => ({});
      baseContext.depthMask = noop;
      baseContext.drawBuffers = noop;
      baseContext.framebufferTexture2D = noop;
      baseContext.getUniformLocation = () => null;
      baseContext.getAttribLocation = () => -1;
      baseContext.isProgram = () => true;
      baseContext.linkProgram = noop;
      baseContext.shaderSource = noop;
      baseContext.uniformMatrix3fv = noop;
      baseContext.uniformMatrix4fv = noop;
      baseContext.vertexAttribPointer = noop;

      // Return the object without Proxy (Proxy seems to break getParameter in some cases)
      return baseContext;
    }
    return null;
  };
});
