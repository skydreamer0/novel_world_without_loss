import * as THREE from './vendor/three.module.min.js';

// 低多邊形等角視圖小舞台：中央新土隨進度擴張，四座器官結構隨等級生長。
const ORGAN_LAYOUT = {
  heart: { pos: [0, 0, -4.6], color: 0xe8654c, emissive: 0xe8654c },
  river: { pos: [4.6, 0, 0], color: 0x4c9be8, emissive: 0x1a3a52 },
  mine: { pos: [0, 0, 4.6], color: 0x6b6357, emissive: 0x000000 },
  forest: { pos: [-4.6, 0, 0], color: 0x3f8a5c, emissive: 0x0c2415 },
};

export function createCityScene(container) {
  const width = container.clientWidth || 600;
  const height = container.clientHeight || 320;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b0e14, 0.028);

  const d = 9;
  const aspect = width / height;
  const camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 100);
  camera.position.set(11, 10, 11);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0x40485c, 1.1));
  const key = new THREE.DirectionalLight(0xe8a84c, 1.1);
  key.position.set(6, 10, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x4c6be8, 0.4);
  rim.position.set(-8, 4, -6);
  scene.add(rim);

  // 虛無星野：不隨舞台旋轉
  const starGeo = new THREE.BufferGeometry();
  const starCount = 260;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 22 + Math.random() * 18;
    const theta = Math.random() * Math.PI * 2;
    const y = (Math.random() - 0.6) * 14;
    starPos[i * 3] = Math.cos(theta) * r;
    starPos[i * 3 + 1] = y;
    starPos[i * 3 + 2] = Math.sin(theta) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xe8a84c, size: 0.12, transparent: true, opacity: 0.5 }));
  scene.add(stars);

  const stage = new THREE.Group();
  scene.add(stage);

  const groundMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3d, roughness: 0.9, metalness: 0.05 });
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.4, 0.4, 8), groundMat);
  ground.position.y = -0.2;
  stage.add(ground);

  const organs = {};
  for (const [key_, cfg] of Object.entries(ORGAN_LAYOUT)) {
    const group = new THREE.Group();
    group.position.set(...cfg.pos);
    stage.add(group);
    organs[key_] = { group, cfg, builtLevel: -1, forestMeshes: [] };
  }

  // 心臟：懸浮水晶核心
  {
    const o = organs.heart;
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.6, 0),
      new THREE.MeshStandardMaterial({ color: o.cfg.color, emissive: o.cfg.emissive, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.4 })
    );
    mesh.position.y = 0.9;
    o.group.add(mesh);
    o.mesh = mesh;
  }
  // 骨骼：岩錐
  {
    const o = organs.mine;
    const mesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.7, 1, 6),
      new THREE.MeshStandardMaterial({ color: o.cfg.color, roughness: 0.95 })
    );
    mesh.position.y = 0.15;
    o.group.add(mesh);
    o.mesh = mesh;
  }
  // 經脈：河環
  {
    const o = organs.river;
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.6, 0.12, 8, 20),
      new THREE.MeshStandardMaterial({ color: o.cfg.color, emissive: o.cfg.emissive, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.3 })
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = 0.15;
    o.group.add(mesh);
    o.mesh = mesh;
  }

  // 人口光點
  const maxPop = 80;
  const popGeo = new THREE.BufferGeometry();
  popGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxPop * 3), 3));
  const popPoints = new THREE.Points(popGeo, new THREE.PointsMaterial({ color: 0xe8a84c, size: 0.14, transparent: true, opacity: 0.9 }));
  stage.add(popPoints);
  let popShown = 0;

  let clock = new THREE.Clock();
  let disposed = false;
  let targetGroundScale = 1;
  let currentGroundScale = 1;

  function layoutPopulation(count) {
    const arr = popGeo.attributes.position.array;
    for (let i = 0; i < maxPop; i++) {
      if (i < count) {
        const r = Math.random() * 2.6;
        const theta = Math.random() * Math.PI * 2;
        arr[i * 3] = Math.cos(theta) * r;
        arr[i * 3 + 1] = 0.05;
        arr[i * 3 + 2] = Math.sin(theta) * r;
      } else {
        arr[i * 3 + 1] = -99;
      }
    }
    popGeo.attributes.position.needsUpdate = true;
  }

  function buildForest(level) {
    const o = organs.forest;
    o.forestMeshes.forEach((m) => o.group.remove(m));
    o.forestMeshes = [];
    const count = level * 3;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.6 + Math.random() * 0.3, 5),
        new THREE.MeshStandardMaterial({ color: o.cfg.color, emissive: o.cfg.emissive, emissiveIntensity: 0.3, roughness: 0.8 })
      );
      const r = 0.3 + Math.random() * 1.1;
      const theta = Math.random() * Math.PI * 2;
      mesh.position.set(Math.cos(theta) * r, 0.3, Math.sin(theta) * r);
      o.group.add(mesh);
      o.forestMeshes.push(mesh);
    }
    o.builtLevel = level;
  }

  function update(state) {
    const r = state.resources;
    const organLevels = state.organs;

    targetGroundScale = clampLocal(0.85 + (state.turn / 32) * 0.55 + r.population / 9000, 0.85, 2.1);

    const heartLevel = organLevels.heart || 0;
    organs.heart.mesh.scale.setScalar(0.5 + heartLevel * 0.32);
    organs.heart.mesh.material.emissiveIntensity = 0.35 + heartLevel * 0.18;

    const mineLevel = organLevels.mine || 0;
    organs.mine.mesh.scale.set(1, 0.4 + mineLevel * 0.5, 1);
    organs.mine.mesh.position.y = 0.15 + (0.4 + mineLevel * 0.5 - 1) * 0.5;

    const riverLevel = organLevels.river || 0;
    organs.river.mesh.scale.setScalar(0.6 + riverLevel * 0.22);

    const forestLevel = clampLocal(organLevels.forest || 0, 0, 5);
    if (forestLevel !== organs.forest.builtLevel) buildForest(forestLevel);

    const popCount = clampLocal(Math.round((r.population / 8000) * maxPop), 0, maxPop);
    if (Math.abs(popCount - popShown) >= 2) {
      layoutPopulation(popCount);
      popShown = popCount;
    }
  }

  function clampLocal(v, min, max) { return Math.min(max, Math.max(min, v)); }

  function tick() {
    if (disposed) return;
    const t = clock.getElapsedTime();
    currentGroundScale += (targetGroundScale - currentGroundScale) * 0.04;
    ground.scale.set(currentGroundScale, 1, currentGroundScale);
    stage.rotation.y = t * 0.06;
    organs.heart.mesh.rotation.y = t * 0.8;
    organs.heart.mesh.position.y = 0.9 + Math.sin(t * 1.4) * 0.06;
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();

  function resize() {
    const w = container.clientWidth || width;
    const h = container.clientHeight || height;
    const a = w / h;
    camera.left = -d * a; camera.right = d * a; camera.top = d; camera.bottom = -d;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  function destroy() {
    disposed = true;
    ro.disconnect();
    renderer.dispose();
    container.removeChild(renderer.domElement);
  }

  return { update, destroy };
}
