import { Line, BufferGeometry, LineBasicMaterial, BufferAttribute } from 'three';
import { DISTANCE_SCALE } from '@/physics/constants.js';

// Visual mapping for the four terminal classifications from src/physics/orbit-prediction.js.
const STATUS_COLORS = {
  orbit:            0x4ade80, // green   — confirmed closed orbit
  escape:           0x60a5fa, // blue    — escape trajectory (unbound)
  collision:        0xef4444, // red     — collides with a body
  prediction_limit: 0xeab308, // yellow  — no full orbit in the time window
};

// Single re-used Line in the scene. Capacity is fixed (MAX_POINTS) and the draw range
// is updated each prediction. Cheaper than rebuilding geometry every time the user
// drags the speed slider.
export function createTrajectoryLine(scene, { maxPoints = 5000 } = {}) {
  const positions = new Float32Array(maxPoints * 3);
  const geom = new BufferGeometry();
  geom.setAttribute('position', new BufferAttribute(positions, 3));
  geom.setDrawRange(0, 0);
  const mat = new LineBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false,
  });
  const line = new Line(geom, mat);
  line.frustumCulled = false; // trajectory can be huge; no culling
  line.visible = false;
  line.renderOrder = 2;       // draw after opaque bodies
  scene.add(line);

  function setTrajectory(trajectoryPhysical, status) {
    if (!trajectoryPhysical || trajectoryPhysical.length < 2) {
      line.visible = false;
      geom.setDrawRange(0, 0);
      return;
    }
    const n = Math.min(trajectoryPhysical.length, maxPoints);
    for (let i = 0; i < n; i++) {
      const p = trajectoryPhysical[i];
      positions[i * 3 + 0] = p[0] * DISTANCE_SCALE;
      positions[i * 3 + 1] = p[1] * DISTANCE_SCALE;
      positions[i * 3 + 2] = p[2] * DISTANCE_SCALE;
    }
    geom.attributes.position.needsUpdate = true;
    geom.setDrawRange(0, n);
    geom.computeBoundingSphere();
    mat.color.setHex(STATUS_COLORS[status] ?? 0xffffff);
    line.visible = true;
  }

  function clear() {
    line.visible = false;
    geom.setDrawRange(0, 0);
  }

  return { setTrajectory, clear, line, STATUS_COLORS };
}
