import { Mesh, SphereGeometry, MeshBasicMaterial, ArrowHelper, Vector3 } from 'three';
import { DISTANCE_SCALE } from '@/physics/constants.js';

// A ghost is a transparent preview of a body the user can configure before committing.
// The arrow tail is at the body's surface, head points outward in the launch direction.
// External callers drive direction either via setDirectionFromVector (arrow drag) or
// setAzimuth/setElevation (slider). onDirectionChange fires whenever direction changes, so
// the host UI can keep sliders in sync with arrow drags.
export function createGhost({
  spec,
  position,
  scene,
  baseRadius,
  defaultSpeed = 10000,
  defaultDirection = null,
  onDirectionChange = () => {},
}) {
  // Solid translucent sphere coloured with the body's defaultColor — recognisable but
  // clearly a preview (not a real object). The host shows the body's name in the panel.
  const mat = new MeshBasicMaterial({
    color: spec.defaultColor || '#888',
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const mesh = new Mesh(new SphereGeometry(1, 32, 32), mat);
  mesh.scale.setScalar(baseRadius);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.userData.isGhost = true;
  scene.add(mesh);

  // Arrow: tail anchored just past the body's surface (in unit-sphere coords, that's at r=1).
  // Length scales with speed so faster launches show a longer arrow.
  const ARROW_BASE_LEN = 1.8;
  const arrow = new ArrowHelper(
    new Vector3(0, 0, -1),
    new Vector3(0, 0, 0),
    ARROW_BASE_LEN,
    0xffe24a,
    0.45,
    0.25,
  );
  mesh.add(arrow);

  const state = {
    sizeMult: 1,
    spinMult: 1,
    speed: defaultSpeed,
    azimuthDeg: 0,
    elevationDeg: 0,
  };
  if (defaultDirection && defaultDirection.lengthSq() > 0) {
    const d = defaultDirection.clone().normalize();
    state.azimuthDeg = ((Math.atan2(-d.z, d.x) * 180 / Math.PI) % 360 + 360) % 360;
    state.elevationDeg = Math.asin(Math.max(-1, Math.min(1, d.y))) * 180 / Math.PI;
  }

  function directionVector() {
    const az = state.azimuthDeg * Math.PI / 180;
    const el = state.elevationDeg * Math.PI / 180;
    return new Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), -Math.sin(az) * Math.cos(el));
  }

  function update() {
    const dir = directionVector();
    arrow.setDirection(dir);
    const lenMult = 1 + Math.min(2.5, state.speed / 18000);
    arrow.setLength(ARROW_BASE_LEN * lenMult, 0.45, 0.25);
  }

  function setSize(m)  { state.sizeMult = m; mesh.scale.setScalar(baseRadius * m); }
  function setSpin(m)  { state.spinMult = m; }
  function setSpeed(s) { state.speed = s; update(); }
  function setAzimuth(a)   { state.azimuthDeg = ((a % 360) + 360) % 360; update(); }
  function setElevation(e) { state.elevationDeg = Math.max(-90, Math.min(90, e)); update(); }

  // Set direction from a world-space vector. Computes az/el and notifies the host UI.
  function setDirectionFromVector(vec) {
    if (!vec || vec.lengthSq() === 0) return;
    const n = vec.clone().normalize();
    state.azimuthDeg = ((Math.atan2(-n.z, n.x) * 180 / Math.PI) % 360 + 360) % 360;
    state.elevationDeg = Math.asin(Math.max(-1, Math.min(1, n.y))) * 180 / Math.PI;
    update();
    onDirectionChange(state.azimuthDeg, state.elevationDeg);
  }

  function destroy() {
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
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
    return {
      spec,
      position: physPos,
      velocity: [dir.x * state.speed, dir.y * state.speed, dir.z * state.speed],
      sizeMult: state.sizeMult,
      spinMult: state.spinMult,
    };
  }

  update();
  return {
    mesh, state,
    setSize, setSpin, setSpeed, setAzimuth, setElevation,
    setDirectionFromVector,
    destroy, getCommit,
  };
}
