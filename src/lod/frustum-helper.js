import { Frustum, Matrix4 } from 'three';

export function createFrustumHelper() {
  const frustum = new Frustum();
  const m = new Matrix4();
  function update(camera) {
    m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(m);
  }
  function intersectsSphere(sphere) { return frustum.intersectsSphere(sphere); }
  return { update, intersectsSphere };
}
