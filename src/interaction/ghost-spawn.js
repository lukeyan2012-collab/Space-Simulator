import {
  Mesh, Group, SphereGeometry, CylinderGeometry, ConeGeometry,
  MeshBasicMaterial, Vector3, Quaternion,
} from 'three';
import { DISTANCE_SCALE } from '@/physics/constants.js';

// Custom thick arrow (cylinder shaft + cone head). Pointing axis is +Y in local space;
// setDirection rotates the whole group so +Y aligns with the requested world direction.
// We expose `head` and `shaft` as meshes so the host can raycast against them and pick
// "arrow drag" vs "ghost-body drag".
function createThickArrow({
  length = 1.8, color = 0xffe24a,
  shaftRadius = 0.085, headRadius = 0.22, headLength = 0.45,
}) {
  const mat = new MeshBasicMaterial({
    color, transparent: true, opacity: 0.95, depthWrite: false,
  });
  let _length = length;
  const group = new Group();
  const shaft = new Mesh(new CylinderGeometry(shaftRadius, shaftRadius, 1, 12), mat);
  const head  = new Mesh(new ConeGeometry(headRadius, headLength, 16), mat);
  group.add(shaft);
  group.add(head);

  function rebuildShaft() {
    const sLen = Math.max(0.01, _length - headLength);
    shaft.geometry.dispose();
    shaft.geometry = new CylinderGeometry(shaftRadius, shaftRadius, sLen, 12);
    shaft.position.set(0, sLen / 2, 0);
    head.position.set(0, sLen + headLength / 2, 0);
  }

  function setDirection(dir) {
    const n = dir.clone().normalize();
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), n);
    group.quaternion.copy(q);
  }
  function setLength(len) {
    if (len === _length) return;
    _length = len;
    rebuildShaft();
  }
  function dispose() {
    shaft.geometry.dispose();
    head.geometry.dispose();
    mat.dispose();
  }
  rebuildShaft();
  return { group, shaft, head, setDirection, setLength, dispose };
}

// A ghost is a transparent preview of a body the user can configure before committing.
// The arrow tail sits at the body's center; tip points in the launch direction. External
// callers drive direction either via setDirectionFromVector (arrow drag) or
// setAzimuth/setElevation (slider). Position can also be moved post-creation via setPosition
// — the host wires this to a body-drag interaction.
export function createGhost({
  spec,
  position,
  scene,
  baseRadius,
  defaultSpeed = 10000,
  defaultDirection = null,
  onDirectionChange = () => {},
  onPositionChange = () => {},
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

  const ARROW_BASE_LEN = 1.9;
  const arrow = createThickArrow({ length: ARROW_BASE_LEN });
  mesh.add(arrow.group);

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
    arrow.setDirection(directionVector());
    const lenMult = 1 + Math.min(2.5, state.speed / 18000);
    arrow.setLength(ARROW_BASE_LEN * lenMult);
  }

  function setSize(m)  { state.sizeMult = m; mesh.scale.setScalar(baseRadius * m); }
  function setSpin(m)  { state.spinMult = m; }
  function setSpeed(s) { state.speed = s; update(); }
  function setAzimuth(a)   { state.azimuthDeg = ((a % 360) + 360) % 360; update(); }
  function setElevation(e) { state.elevationDeg = Math.max(-90, Math.min(90, e)); update(); }
  function setPosition(worldPos) {
    mesh.position.copy(worldPos);
    onPositionChange(mesh.position);
  }

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
    arrow.dispose();
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
    mesh, state, arrow,
    setSize, setSpin, setSpeed, setAzimuth, setElevation, setPosition,
    setDirectionFromVector,
    destroy, getCommit,
  };
}
