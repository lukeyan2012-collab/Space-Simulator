import { BufferGeometry, BufferAttribute, Points, PointsMaterial } from 'three';

export function createStarfield({ count = 8000, radius = 8000 } = {}) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // uniform on sphere via Marsaglia
    let u, v, s;
    do {
      u = Math.random() * 2 - 1;
      v = Math.random() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const factor = 2 * Math.sqrt(1 - s);
    const x = u * factor;
    const y = v * factor;
    const z = 1 - 2 * s;
    positions[i * 3 + 0] = x * radius;
    positions[i * 3 + 1] = y * radius;
    positions[i * 3 + 2] = z * radius;
  }
  const geom = new BufferGeometry();
  geom.setAttribute('position', new BufferAttribute(positions, 3));
  const mat = new PointsMaterial({ size: 1.2, sizeAttenuation: false, color: 0xffffff });
  return new Points(geom, mat);
}
