import { Vector3, Plane, Raycaster, Vector2, Mesh, SphereGeometry, MeshBasicMaterial } from 'three';
import { G, DISTANCE_SCALE } from '@/physics/constants.js';

const NEIGHBOR_RANGE_UNITS = 50; // scene units within which we auto-orbit a massive neighbor
const MIN_MASS_FOR_ORBIT_KG = 1e22;

export function circularOrbitVelocity(point, center, M, upVec) {
  const radial = new Vector3().subVectors(point, center);
  const r = radial.length();
  if (r === 0) return new Vector3();
  const speed = Math.sqrt(G * M / r);
  const tangent = new Vector3().crossVectors(upVec, radial).normalize();
  return tangent.multiplyScalar(speed);
}

// Single drop-handler interface: `onDrop(body, positionScene, defaultVelocityMs)` is called
// when a sidebar item is released over the canvas. The host (main.js) decides whether to
// open the ghost configurator or spawn the body directly.
export function createDragDrop({ scene, camera, domElement, manifest, getRecords, getCamTarget, onDrop }) {
  const ray = new Raycaster();
  const mouse = new Vector2();
  const plane = new Plane();
  const intersect = new Vector3();
  let armedId = null;        // sidebar item being dragged via HTML5 drag
  let armedForTap = null;    // touch fallback: tap-arm-then-tap-canvas
  let ghost = null;

  function makeGhost(body) {
    const m = new Mesh(
      new SphereGeometry(1, 16, 16),
      new MeshBasicMaterial({ color: body.defaultColor, transparent: true, opacity: 0.4, depthWrite: false }),
    );
    m.scale.setScalar(2);
    return m;
  }

  function getDropPlane() {
    // A plane through the camera target, perpendicular to the camera's view direction.
    const target = (typeof getCamTarget === 'function' ? getCamTarget() : null) || new Vector3(0,0,0);
    const normal = camera.getWorldDirection(new Vector3()).negate();
    plane.setFromNormalAndCoplanarPoint(normal, target);
    return plane;
  }

  function projectClientToScene(clientX, clientY, out) {
    const r = domElement.getBoundingClientRect();
    mouse.x = ((clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(mouse, camera);
    const p = getDropPlane();
    return ray.ray.intersectPlane(p, out);
  }

  function findNeighborMass(scenePosUnits) {
    const records = getRecords();
    let nearest = null, dist = Infinity;
    for (const r of records) {
      if (!r.body || (r.body.realMass_kg ?? 0) < MIN_MASS_FOR_ORBIT_KG) continue;
      const d = r.object.position.distanceTo(scenePosUnits);
      if (d < dist && d < NEIGHBOR_RANGE_UNITS) { dist = d; nearest = r; }
    }
    return nearest;
  }

  function dropAt(bodyId, clientX, clientY) {
    const body = manifest.bodies.find(b => b.id === bodyId);
    if (!body) return;
    const sceneUnits = projectClientToScene(clientX, clientY, new Vector3());
    if (!sceneUnits) return;

    // Compute a default orbital velocity if dropping near a massive neighbor — the host can
    // use it as-is (direct spawn) or as a starting value for the ghost configurator.
    let velocityMs = [0, 0, 0];
    const neighbor = findNeighborMass(sceneUnits);
    if (neighbor) {
      const positionM = sceneUnits.clone().divideScalar(DISTANCE_SCALE);
      const neighborPosM = new Vector3(...neighbor.object.position.toArray()).divideScalar(DISTANCE_SCALE);
      const upVec = camera.up.clone();
      velocityMs = circularOrbitVelocity(positionM, neighborPosM, neighbor.body.realMass_kg, upVec).toArray();
    }

    if (typeof onDrop === 'function') {
      onDrop(body, [sceneUnits.x, sceneUnits.y, sceneUnits.z], velocityMs);
    }
    if (ghost) { scene.remove(ghost); ghost = null; }
  }

  // HTML5 drag-and-drop on the canvas
  domElement.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!ghost && armedId) {
      const body = manifest.bodies.find(b => b.id === armedId);
      if (body) { ghost = makeGhost(body); scene.add(ghost); }
    }
    if (ghost) {
      const out = new Vector3();
      if (projectClientToScene(e.clientX, e.clientY, out)) ghost.position.copy(out);
    }
  });
  domElement.addEventListener('drop', (e) => {
    e.preventDefault();
    let id = armedId;
    if (!id && e.dataTransfer && typeof e.dataTransfer.getData === 'function') {
      try { id = e.dataTransfer.getData('text/plain') || null; } catch {}
    }
    if (id) dropAt(id, e.clientX, e.clientY);
    armedId = null;
  });
  domElement.addEventListener('dragleave', () => { if (ghost) { scene.remove(ghost); ghost = null; } });

  // Touch / no-drag fallback: arm a sidebar item, then tap canvas.
  function armForTapAdd(id) { armedForTap = id; }
  domElement.addEventListener('click', (e) => {
    if (!armedForTap) return;
    dropAt(armedForTap, e.clientX, e.clientY);
    armedForTap = null;
  });

  function beginDragFromSidebar(id) { armedId = id; }

  return { beginDragFromSidebar, armForTapAdd };
}
