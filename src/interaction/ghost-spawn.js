import { Mesh, SphereGeometry, MeshBasicMaterial, ArrowHelper, Vector3, BackSide } from 'three';
import { DISTANCE_SCALE } from '@/physics/constants.js';

// A ghost is a transparent preview of a body that the user can configure before committing.
// It is rendered into the scene but NOT added to the verlet engine — no gravity, no
// collisions. When the user clicks "Insert" the parent UI calls `getCommit()` and uses the
// returned spec/position/velocity to spawn a real body.
//
// The arrow is anchored at the body's surface (tail) pointing outward in the launch direction.
// Direction is parameterised by azimuth + elevation (degrees) — both come from sliders.
export function createGhost({ spec, position, scene, baseRadius, defaultSpeed = 10000 }) {
  // Body ghost: wireframe + semi-transparent so the user can see through it.
  const bodyMat = new MeshBasicMaterial({
    color: spec.defaultColor || '#888',
    transparent: true,
    opacity: 0.35,
    wireframe: true,
    side: BackSide,
  });
  const fillMat = new MeshBasicMaterial({
    color: spec.defaultColor || '#888',
    transparent: true,
    opacity: 0.15,
  });
  const mesh = new Mesh(new SphereGeometry(1, 32, 32), fillMat);
  const wire = new Mesh(new SphereGeometry(1.001, 24, 24), bodyMat);
  mesh.add(wire);
  mesh.scale.setScalar(baseRadius);
  mesh.position.set(position[0], position[1], position[2]);
  scene.add(mesh);

  // Launch direction arrow, child of mesh so it inherits scale/position. Length is in the
  // body's unit-scale (1 = one body radius), so visual length scales with the ghost size.
  const ARROW_BASE_LEN = 1.6;
  const arrow = new ArrowHelper(
    new Vector3(0, 0, -1),  // initial direction
    new Vector3(0, 0, 0),   // origin at body center
    ARROW_BASE_LEN,
    0xffe24a,
    0.4,                    // head length
    0.22,                   // head width
  );
  mesh.add(arrow);

  const state = {
    sizeMult: 1,
    spinMult: 1,
    speed: defaultSpeed,
    azimuthDeg: 0,    // 0 = +X, 90 = -Z, 180 = -X, 270 = +Z (in ecliptic plane)
    elevationDeg: 0,  // 0 = ecliptic plane; positive tilts up (+Y)
  };

  function directionVector() {
    const az = state.azimuthDeg * Math.PI / 180;
    const el = state.elevationDeg * Math.PI / 180;
    return new Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), -Math.sin(az) * Math.cos(el));
  }

  function update() {
    mesh.scale.setScalar(baseRadius * state.sizeMult);
    const dir = directionVector();
    arrow.setDirection(dir);
    // Arrow length scales (slightly) with speed so the user gets visual feedback.
    const lenMult = 1 + Math.min(2, state.speed / 25000);
    arrow.setLength(ARROW_BASE_LEN * lenMult, 0.4, 0.22);
  }

  function setSize(m)     { state.sizeMult = m;   update(); }
  function setSpin(m)     { state.spinMult = m; }
  function setSpeed(s)    { state.speed = s;     update(); }
  function setAzimuth(a)  { state.azimuthDeg = a;   update(); }
  function setElevation(e){ state.elevationDeg = e; update(); }

  function destroy() {
    scene.remove(mesh);
    wire.geometry.dispose(); wire.material.dispose();
    mesh.geometry.dispose(); mesh.material.dispose();
    // ArrowHelper owns its own lines / cone material; dispose them.
    arrow.line?.geometry?.dispose();
    arrow.line?.material?.dispose();
    arrow.cone?.geometry?.dispose();
    arrow.cone?.material?.dispose();
  }

  function getCommit() {
    const physPos = [
      mesh.position.x / DISTANCE_SCALE,
      mesh.position.y / DISTANCE_SCALE,
      mesh.position.z / DISTANCE_SCALE,
    ];
    const dir = directionVector();
    const vel = [dir.x * state.speed, dir.y * state.speed, dir.z * state.speed];
    return {
      spec,
      position: physPos,
      velocity: vel,
      sizeMult: state.sizeMult,
      spinMult: state.spinMult,
    };
  }

  update();
  return { mesh, setSize, setSpin, setSpeed, setAzimuth, setElevation, destroy, getCommit, state };
}
