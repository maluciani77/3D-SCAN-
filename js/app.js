const canvas  = document.getElementById('renderCanvas');
const engine  = new BABYLON.Engine(canvas, true, { disableWebGL2Support: false }, true);
engine.inputElement = canvas;
const moveInd = document.getElementById('moveIndicator');

let scene, camera, loaded = false;

let isMoving = false, moveFrom = null, moveTo = null, moveProgress = 0;
let MOVE_SPEED = 0.05;

const createScene = async () => {
  scene = new BABYLON.Scene(engine);
  scene.gravity = new BABYLON.Vector3(0, -0.5, 0);
  scene.collisionsEnabled = true;
  scene.clearColor = new BABYLON.Color4(0.13, 0.13, 0.14, 1);

  camera = new BABYLON.UniversalCamera('cam', new BABYLON.Vector3(0, 1.65, 0), scene);
  camera.minZ = 0.05;
  camera.maxZ = 300;
  camera.fov  = 1.05;
  camera.checkCollisions = true;
  camera.applyGravity    = true;
  camera.ellipsoid       = new BABYLON.Vector3(0.35, 0.82, 0.35);
  camera.ellipsoidOffset = new BABYLON.Vector3(0, 0.82, 0);
  camera.inputs.clear();
  camera.setTarget(new BABYLON.Vector3(1, 1.65, 0));

  const hemi = new BABYLON.HemisphericLight('h', new BABYLON.Vector3(0, 1, 0), scene);
  hemi.intensity   = 1.6;
  hemi.diffuse     = new BABYLON.Color3(1, 0.98, 0.94);
  hemi.groundColor = new BABYLON.Color3(0.5, 0.5, 0.52);

  const dir = new BABYLON.DirectionalLight('d', new BABYLON.Vector3(-0.5, -1, -0.5), scene);
  dir.intensity = 0.5;

  updateProgress(20, 'Cargando modelo...');
  const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);

  const result = await BABYLON.SceneLoader.ImportMeshAsync(
    '', baseUrl, '12_5_2026.glb', scene,
    evt => {
      if (evt.lengthComputable)
        updateProgress(20 + (evt.loaded / evt.total) * 65, 'Cargando modelo...');
    }
  );

  updateProgress(90, 'Preparando...');

  let min = new BABYLON.Vector3( 9999,  9999,  9999);
  let max = new BABYLON.Vector3(-9999, -9999, -9999);

  result.meshes.forEach(m => {
    m.checkCollisions = true;
    if (!m.getBoundingInfo) return;
    const bi = m.getBoundingInfo();
    min = BABYLON.Vector3.Minimize(min, bi.boundingBox.minimumWorld);
    max = BABYLON.Vector3.Maximize(max, bi.boundingBox.maximumWorld);
  });

  const center = BABYLON.Vector3.Center(min, max);
  const size   = max.subtract(min);
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale  = maxDim > 0 ? 30 / maxDim : 1;

  result.meshes.forEach(m => {
    m.scaling  = new BABYLON.Vector3(scale, scale, scale);
    m.position = m.position.subtract(center.scale(scale));
  });

  const floorY = min.y * scale - center.y * scale;
  camera.position = new BABYLON.Vector3(0, floorY + 1.65, 0);
  camera.setTarget(new BABYLON.Vector3(3, floorY + 1.65, 0));

  updateProgress(100, '¡Listo!');
  loaded = true;

  setTimeout(() => {
    document.getElementById('loadingText').textContent = 'Listo para explorar';
    document.getElementById('enterBtn').style.display = 'block';
  }, 300);

  setTimeout(() => {
    document.getElementById('hint').style.opacity = '0';
  }, 6000);
};

function updateProgress(p, t) {
  document.getElementById('barFill').style.width = p + '%';
  document.getElementById('loadingText').textContent = t;
}

function enterScene() {
  const l = document.getElementById('loading');
  l.style.opacity = '0';
  setTimeout(() => {
    l.style.display = 'none';
    canvas.focus();
  }, 700);
}

function easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

engine.runRenderLoop(() => {
  if (!scene) return;
  if (isMoving && moveFrom && moveTo) {
    moveProgress = Math.min(moveProgress + MOVE_SPEED, 1);
    const e = easeInOut(moveProgress);
    camera.position.x = BABYLON.Scalar.Lerp(moveFrom.x, moveTo.x, e);
    camera.position.z = BABYLON.Scalar.Lerp(moveFrom.z, moveTo.z, e);
    if (moveProgress >= 1) {
      isMoving = false;
      moveInd.style.animation = 'none';
      void moveInd.offsetWidth;
      moveInd.style.animation = 'markerFade 0.35s ease forwards';
      setTimeout(() => { moveInd.style.display = 'none'; }, 350);
    }
  }
  scene.render();
});

function startMove(clientX, clientY) {
  if (!loaded) return;
  const pick = scene.pick(clientX, clientY, null, false, camera);
  let target;
  if (pick && pick.hit && pick.pickedPoint) {
    target = new BABYLON.Vector3(pick.pickedPoint.x, camera.position.y, pick.pickedPoint.z);
  } else {
    const fwd = new BABYLON.Vector3(
      Math.sin(camera.rotation.y), 0, Math.cos(camera.rotation.y)
    ).normalize();
    target = camera.position.add(fwd.scale(6));
    target.y = camera.position.y;
  }

  const dist = BABYLON.Vector3.Distance(camera.position, target);
  if (dist < 0.25) return;

  const travelTime = Math.min(1.0, 0.45 + dist * 0.025);
  MOVE_SPEED = 1 / (travelTime * 60);

  moveInd.style.left = clientX + 'px';
  moveInd.style.top  = clientY + 'px';
  moveInd.style.display = 'block';
  moveInd.style.animation = 'none';
  void moveInd.offsetWidth;
  moveInd.style.animation = 'markerAppear 0.25s ease forwards';

  moveFrom     = camera.position.clone();
  moveTo       = target;
  moveProgress = 0;
  isMoving     = true;
}

let isDragging = false;
let lastX = 0, lastY = 0;
const activePointers = new Set();

canvas.style.cursor = 'grab';

canvas.addEventListener('pointerdown', e => {
  activePointers.add(e.pointerId);
  if (activePointers.size > 1) {
    isDragging = false;
    return;
  }
  if (e.button !== 0 && e.pointerType !== 'touch') return;
  e.preventDefault();
  isDragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
  canvas.style.cursor = 'grabbing';
});

canvas.addEventListener('pointermove', e => {
  if (!isDragging || !loaded || activePointers.size > 1) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  camera.rotation.y -= dx * 0.004;
  camera.rotation.x -= dy * 0.004;
  camera.rotation.x = Math.max(-1.4, Math.min(1.4, camera.rotation.x));
  lastX = e.clientX;
  lastY = e.clientY;
});

canvas.addEventListener('pointerup', e => {
  activePointers.delete(e.pointerId);
  isDragging = false;
  canvas.releasePointerCapture(e.pointerId);
  canvas.style.cursor = 'grab';
});

canvas.addEventListener('pointercancel', e => {
  activePointers.delete(e.pointerId);
  isDragging = false;
  canvas.releasePointerCapture(e.pointerId);
  canvas.style.cursor = 'grab';
});

canvas.addEventListener('dblclick', e => {
  startMove(e.clientX, e.clientY);
});

const FOV_MAX = 1.05;
const FOV_MIN = 0.5;

canvas.addEventListener('wheel', e => {
  if (!loaded) return;
  e.preventDefault();
  camera.fov = Math.max(FOV_MIN, Math.min(FOV_MAX, camera.fov + Math.sign(e.deltaY) * 0.06));
}, { passive: false });

let lastTouchX = 0, lastTouchY = 0;
let lastTapTime = 0;
let pinchDist = 0;

canvas.addEventListener('touchstart', e => {
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    pinchDist = Math.sqrt(dx*dx + dy*dy);
    return;
  }
  lastTouchX = e.touches[0].clientX;
  lastTouchY = e.touches[0].clientY;
  const now = Date.now();
  if (now - lastTapTime < 300) {
    startMove(e.touches[0].clientX, e.touches[0].clientY);
  }
  lastTapTime = now;
}, { passive: true });

canvas.addEventListener('touchmove', e => {
  if (!loaded || e.touches.length !== 2) return;
  const dx = e.touches[0].clientX - e.touches[1].clientX;
  const dy = e.touches[0].clientY - e.touches[1].clientY;
  const newDist = Math.sqrt(dx*dx + dy*dy);
  camera.fov = Math.max(FOV_MIN, Math.min(FOV_MAX, camera.fov - (newDist - pinchDist) * 0.004));
  pinchDist = newDist;
}, { passive: true });

window.addEventListener('resize', () => engine.resize());

createScene().catch(err => {
  console.error(err);
  document.getElementById('loadingText').textContent = 'Error al cargar el modelo.';
});
