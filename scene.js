// 最初の画面の3D：系統用蓄電池コンテナ（コードで作った模型）
// スクロールの進み具合（0〜1）で、カメラが回り込む → 扉が開く → 中の電池が光る → 送電線から電気が流れ込む
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createScene(canvas, opts) {
  const mobile = opts.mobile;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05080F');
  scene.fog = new THREE.FogExp2('#05080F', 0.045);

  const camera = new THREE.PerspectiveCamera(mobile ? 46 : 34, 1, 0.1, 120);

  // 光
  scene.add(new THREE.HemisphereLight('#9FB8FF', '#05080F', 0.55));
  const key = new THREE.DirectionalLight('#FFFFFF', 1.6); key.position.set(-6, 9, 7); scene.add(key);
  const rim = new THREE.DirectionalLight('#3EE6FF', 2.2); rim.position.set(7, 3, -6); scene.add(rim);

  // 地面：細いシアンの格子
  const grid = new THREE.GridHelper(80, 80, '#1C3A5A', '#0E1C2E');
  grid.material.transparent = true; grid.material.opacity = 0.55;
  scene.add(grid);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.MeshStandardMaterial({ color: '#070C16', roughness: 0.9, metalness: 0.1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.002; scene.add(floor);

  // ===== コンテナ =====
  const W = 6, H = 2.6, D = 2.44;
  const box = new THREE.Group(); scene.add(box);
  const shell = new THREE.MeshStandardMaterial({ color: '#E6ECF3', roughness: 0.32, metalness: 0.62 });
  const dark = new THREE.MeshStandardMaterial({ color: '#0B1220', roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide });

  // 屋根・床・背面・側面（前面は扉）
  const thick = 0.06;
  const part = (w, h, d, x, y, z, m = shell) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); box.add(me); return me; };
  part(W, thick, D, 0, H, 0);
  part(W, thick, D, 0, 0.03, 0);
  part(W, H, thick, 0, H / 2, -D / 2);
  part(thick, H, D, -W / 2, H / 2, 0);
  part(thick, H, D, W / 2, H / 2, 0);
  // 中の暗い壁
  const backIn = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.14, H - 0.14), dark); backIn.position.set(0, H / 2, -D / 2 + 0.05); box.add(backIn);
  const ceilLight = new THREE.Mesh(new THREE.BoxGeometry(W - 0.4, 0.02, 0.06), new THREE.MeshBasicMaterial({ color: '#BFF6FF' })); ceilLight.position.set(0, H - 0.1, 0.4); box.add(ceilLight);
  const inLight = new THREE.PointLight('#3EE6FF', 0, 9, 1.6); inLight.position.set(0, 1.4, 0.6); box.add(inLight);

  // 波板（側面・背面の縦リブ）を InstancedMesh で
  const ribGeo = new THREE.BoxGeometry(0.05, H - 0.1, 0.05);
  const ribCount = 2 * Math.floor(W / 0.18) + 2 * Math.floor(D / 0.18);
  const ribs = new THREE.InstancedMesh(ribGeo, shell, ribCount);
  let ri = 0; const mtx = new THREE.Matrix4();
  for (let x = -W / 2 + 0.12; x < W / 2 - 0.05 && ri < ribCount; x += 0.18) { mtx.makeTranslation(x, H / 2, -D / 2 - 0.04); ribs.setMatrixAt(ri++, mtx); }
  for (let z = -D / 2 + 0.12; z < D / 2 - 0.05 && ri < ribCount; z += 0.18) { mtx.makeTranslation(-W / 2 - 0.04, H / 2, z); ribs.setMatrixAt(ri++, mtx); mtx.makeTranslation(W / 2 + 0.04, H / 2, z); ribs.setMatrixAt(ri++, mtx); }
  ribs.count = ri; box.add(ribs);

  // 上のシアンのライン（状態表示の光）
  const glowMat = new THREE.MeshBasicMaterial({ color: '#3EE6FF' });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, 0.03, 0.03), glowMat); strip.position.set(0, H - 0.12, D / 2 + 0.02); box.add(strip);

  // 電池ラック：3段×14列の小さな箱。充電の進み具合で光る
  const cellGeo = new THREE.BoxGeometry(0.3, 0.62, 0.9);
  const cols = 14, rows = 3;
  const cellMats = [];
  const cells = new THREE.Group(); box.add(cells);
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const m = new THREE.MeshStandardMaterial({ color: '#16233A', emissive: '#3EE6FF', emissiveIntensity: 0, roughness: 0.5, metalness: 0.4 });
    cellMats.push({ m, order: c / cols });
    const me = new THREE.Mesh(cellGeo, m);
    me.position.set(-W / 2 + 0.42 + c * ((W - 0.84) / (cols - 1)), 0.45 + r * 0.78, -0.1);
    cells.add(me);
  }

  // 扉：前面を左右2枚（ヒンジで回る）
  const doorMat = new THREE.MeshStandardMaterial({ color: '#E4EAF1', roughness: 0.38, metalness: 0.55 });
  const makeDoor = (side) => {
    const pivot = new THREE.Group(); pivot.position.set(side * W / 2, H / 2, D / 2); box.add(pivot);
    const door = new THREE.Mesh(new THREE.BoxGeometry(W / 2, H - 0.06, 0.05), doorMat); door.position.x = -side * W / 4; pivot.add(door);
    // 扉の縦リブ
    for (let i = 1; i < 9; i++) { const rb = new THREE.Mesh(new THREE.BoxGeometry(0.04, H - 0.3, 0.04), doorMat); rb.position.set(-side * (i * W / 2 / 9), 0, 0.045); pivot.add(rb); }
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 0.06), glowMat); handle.position.set(-side * (W / 2 - 0.15), 0, 0.06); pivot.add(handle);
    return pivot;
  };
  const doorL = makeDoor(-1), doorR = makeDoor(1);

  // ===== 送電線と電気の流れ =====
  const towerMat = new THREE.LineBasicMaterial({ color: '#2C4F78', transparent: true, opacity: 0.9 });
  const tower = (x, z, h) => {
    const pts = [[-0.6, 0, 0.6], [-0.15, h, 0.15], [0.6, 0, 0.6], [0.15, h, 0.15], [0.6, 0, -0.6], [0.15, h, -0.15], [-0.6, 0, -0.6], [-0.15, h, -0.15], [-0.6, 0, 0.6]];
    const g = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p[0] + x, p[1], p[2] + z)));
    const l = new THREE.Line(g, towerMat); scene.add(l);
    const arm = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x - 1.2, h * 0.85, z), new THREE.Vector3(x + 1.2, h * 0.85, z)]);
    scene.add(new THREE.Line(arm, towerMat));
    return new THREE.Vector3(x + 1.2, h * 0.85, z);
  };
  const t1 = tower(-15, -10, 7), t2 = tower(-8, -6, 6);
  const curve = new THREE.CatmullRomCurve3([t1, new THREE.Vector3(-11.5, 4.6, -8), t2, new THREE.Vector3(-5, 3.4, -2.5), new THREE.Vector3(-3.4, 1.6, 0.6), new THREE.Vector3(-0.8, 1.2, 0.8)]);
  const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.012, 6), new THREE.MeshBasicMaterial({ color: '#1B4A6E' }));
  scene.add(wire);

  const N = mobile ? 90 : 180;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(N * 3); const pSeed = new Float32Array(N);
  for (let i = 0; i < N; i++) pSeed[i] = Math.random();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const spark = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: '#7FF3FF', size: mobile ? 0.12 : 0.09, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(spark);

  // 空中のちり
  const dustGeo = new THREE.BufferGeometry(); const dN = mobile ? 160 : 320; const dPos = new Float32Array(dN * 3);
  for (let i = 0; i < dN; i++) { dPos[i * 3] = (Math.random() - 0.5) * 40; dPos[i * 3 + 1] = Math.random() * 10; dPos[i * 3 + 2] = (Math.random() - 0.5) * 30; }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: '#3EE6FF', size: 0.03, transparent: true, opacity: 0.45, depthWrite: false }));
  scene.add(dust);

  // ===== 発光（ブルーム） =====
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.6, 0.45, 0.42);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); composer.setSize(w, h);
    bloom.resolution.set(w * (mobile ? 0.5 : 0.75), h * (mobile ? 0.5 : 0.75));
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas); resize();

  // ===== 進み具合で姿を決める =====
  const state = { p: 0, target: 0, t: 0, mx: 0, my: 0 };
  const clamp = (v) => Math.min(Math.max(v, 0), 1);
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  const camFrom = new THREE.Vector3(mobile ? 9.5 : 7.5, mobile ? 4.2 : 3.4, mobile ? 15 : 12.5);
  const camMid = new THREE.Vector3(mobile ? -5 : -6.5, 3.0, mobile ? 13.5 : 11);
  const camTo = new THREE.Vector3(mobile ? 1.2 : 2.2, mobile ? 3.4 : 2.9, mobile ? 14 : 11);
  const lookFrom = new THREE.Vector3(mobile ? 0 : -2.6, mobile ? 4.6 : 1.3, 0); const lookTo = new THREE.Vector3(0, mobile ? 3.0 : 2.4, 0); const look = new THREE.Vector3();
  const tmp = new THREE.Vector3(); const tp = new THREE.Vector3();
  // 電線上の点を先に計算しておく（毎フレームの曲線計算を省く）
  const SAMPLES = 400; const pathPts = curve.getSpacedPoints(SAMPLES);

  function pose(p, time) {
    // カメラ：0〜0.45 で回り込み、0.45〜1 で正面に寄る
    const a = ease(clamp(p / 0.45)), b = ease(clamp((p - 0.45) / 0.55));
    tmp.copy(camFrom).lerp(camMid, a).lerp(camTo, b);
    tmp.x += state.mx * 0.5; tmp.y += state.my * 0.25;
    camera.position.copy(tmp); look.copy(lookFrom).lerp(lookTo, ease(clamp(p / 0.6))); camera.lookAt(look);
    // 扉：0.3〜0.6 で開く
    const d = ease(clamp((p - 0.3) / 0.3));
    doorL.rotation.y = -d * 1.95; doorR.rotation.y = d * 1.95;
    // 電気：0.45〜 流れ始め、0.55〜0.95 で電池が順に満ちる
    const flow = clamp((p - 0.42) / 0.12);
    spark.material.opacity = flow * 0.95;
    const charge = clamp((p - 0.55) / 0.4);
    cellMats.forEach(({ m, order }) => { m.emissiveIntensity = clamp((charge - order * 0.85) * 6) * 0.85; });
    inLight.intensity = d * 1.5 + charge * 2.5;
    glowMat.color.setHSL(0.52, 1, 0.45 + 0.15 * Math.sin(time * 2));
    bloom.strength = 0.45 + charge * 0.18;
    // 粒を電線に沿って流す
    const arr = pGeo.attributes.position.array;
    for (let i = 0; i < N; i++) {
      const u = (pSeed[i] + time * 0.18) % 1;
      tp.copy(pathPts[Math.min(SAMPLES, Math.max(0, Math.floor(u * SAMPLES)))] || pathPts[0]);
      arr[i * 3] = tp.x + (Math.random() - 0.5) * 0.04; arr[i * 3 + 1] = tp.y + (Math.random() - 0.5) * 0.04; arr[i * 3 + 2] = tp.z;
    }
    pGeo.attributes.position.needsUpdate = true;
    dust.rotation.y = time * 0.01;
  }

  let running = true, raf = 0, last = performance.now();
  function frame(now) {
    raf = 0; const dt = Math.min((now - last) / 1000, 0.05); last = now;
    state.t += opts.reduce ? 0 : dt;
    state.p += (state.target - state.p) * (1 - Math.exp(-dt * 6));
    pose(state.p, state.t);
    composer.render();
    if (running && !opts.reduce) raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  new IntersectionObserver(([e]) => { running = e.isIntersecting; if (running) start(); }).observe(canvas);
  addEventListener('pointermove', (e) => { state.mx = (e.clientX / innerWidth - 0.5) * 2; state.my = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });

  if (opts.reduce) { state.p = state.target = 1; pose(1, 0); composer.render(); } else start();

  return {
    setProgress(v) { state.target = v; if (opts.reduce) { pose(1, 0); composer.render(); } else start(); },
  };
}
