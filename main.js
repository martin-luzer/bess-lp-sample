// スクロールの演出（GSAP + ScrollTrigger）と3Dのつなぎ
import { createScene } from './scene.js?v=2';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 899px)').matches;
const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
document.documentElement.classList.add('js');
gsap.registerPlugin(ScrollTrigger);

// ===== 1. 3Dの最初の画面 =====
const canvas = document.querySelector('.hero-canvas');
let scene = null;
try {
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) throw new Error('no webgl');
  scene = createScene(canvas, { mobile, reduce });
} catch (e) {
  document.documentElement.classList.add('no-webgl');
}

if (!reduce) {
  // スクロール全体で3Dを進め、3つの場面を順に出す
  const tl = gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom bottom', scrub: 0.6,
    onUpdate: (self) => { if (scene) scene.setProgress(self.progress); } } });
  tl.to('.hero-progress i', { scaleX: 1, ease: 'none', duration: 1 }, 0)
    .to('.scroll-hint', { opacity: 0, duration: 0.08 }, 0.02)
    .to('.beat-1', { opacity: 0, y: -60, filter: 'blur(8px)', duration: 0.18, ease: 'power2.in' }, 0.16)
    .fromTo('.beat-2', { opacity: 0, y: 40, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.12, ease: 'power2.out' }, 0.34)
    .to('.beat-2', { opacity: 0, y: -40, filter: 'blur(8px)', duration: 0.1, ease: 'power2.in' }, 0.56)
    .fromTo('.beat-3', { opacity: 0, y: 40, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.12, ease: 'power2.out' }, 0.7);

  // 開いた直後：見出しが1行ずつ立ち上がる
  gsap.from('.beat-1 .eyebrow, .hero-title .l, .hero-sub, .hero-actions', { opacity: 0, y: 30, filter: 'blur(6px)', duration: 1.1, ease: 'expo.out', stagger: 0.12, delay: 0.25 });
} else if (scene) {
  scene.setProgress(1);
}

// ===== 2. 数字が増える =====
document.querySelectorAll('[data-count]').forEach((el) => {
  const end = +el.dataset.count; const o = { v: 0 };
  if (reduce) { el.textContent = end; return; }
  gsap.to(o, { v: end, duration: 1.6, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true }, onUpdate: () => { el.textContent = Math.round(o.v); } });
});

// ===== 3. 大きな一文：1文字ずつ灯す =====
const rt = document.querySelector('.reveal-text');
if (rt) {
  rt.innerHTML = [...rt.textContent].map((c) => `<span class="ch">${c}</span>`).join('');
  const chars = rt.querySelectorAll('.ch');
  if (!reduce) {
    ScrollTrigger.create({ trigger: '.manifesto', start: 'top 75%', end: 'bottom 55%', scrub: true,
      onUpdate: (s) => { const n = Math.floor(s.progress * chars.length); chars.forEach((c, i) => c.classList.toggle('on', i < n)); } });
  }
}

// ===== 4. 登場の動き（見出し・カード・表など） =====
const fx = '.sec-head, .flow-diagram, .card, .table-wrap, .tax-inner, .sim-box, .risk-grid > div, .meeting-body, .faq details, .contact-inner, .photo-caption';
document.querySelectorAll(fx).forEach((el) => el.classList.add('fx'));
if (!reduce) {
  ScrollTrigger.batch('.fx', { start: 'top 88%', once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.09, overwrite: true }) });
  // 写真：スクロールに合わせて寄りながら、角が広がる
  gsap.utils.toArray('.photo-frame').forEach((f) => {
    gsap.fromTo(f, { clipPath: 'inset(8% 8% 8% 8% round 40px)' }, { clipPath: 'inset(0% 0% 0% 0% round 28px)', ease: 'none', scrollTrigger: { trigger: f, start: 'top 95%', end: 'top 35%', scrub: true } });
    gsap.fromTo(f.querySelector('img'), { scale: 1.25, yPercent: -6 }, { scale: 1.05, yPercent: 6, ease: 'none', scrollTrigger: { trigger: f, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  // 収益の図：ノードが順に浮かぶ
  gsap.from('.nodes rect, .nodes text', { opacity: 0, scale: 0.9, transformOrigin: '50% 50%', duration: 0.8, ease: 'back.out(1.6)', stagger: 0.06, scrollTrigger: { trigger: '.flow-diagram', start: 'top 80%', once: true } });
  // 導入の流れ：線が伸び、番号が順に点く
  const steps = document.querySelector('.steps'); const items = steps.querySelectorAll('li');
  ScrollTrigger.create({ trigger: steps, start: 'top 70%', end: 'bottom 60%', scrub: true,
    onUpdate: (s) => { steps.style.setProperty('--prog', s.progress.toFixed(3)); items.forEach((li, i) => li.classList.toggle('on', s.progress >= i / (items.length - 1) - 0.02)); } });
} else {
  document.querySelectorAll('.steps li').forEach((li) => li.classList.add('on'));
}

// ===== 5. 光るカード：マウスの位置に光 =====
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll('.glow-card').forEach((c) => c.addEventListener('pointermove', (e) => {
    const r = c.getBoundingClientRect(); c.style.setProperty('--mx', `${e.clientX - r.left}px`); c.style.setProperty('--my', `${e.clientY - r.top}px`);
  }));
}

// ===== 6. 試算（架空の前提） =====
const mw = document.getElementById('mw');
const out = (id, v) => { document.getElementById(id).textContent = v; };
const bars = document.querySelectorAll('.sim-bars i');
function calc() {
  const p = +mw.value, mwh = p * 4;
  const capex = 0.65 * p * 5 * (p >= 10 ? 0.92 : 1);        // 億円：2MW≒6.5億円を基準に、規模で少し下がる
  const rev = mwh * 0.145 * (p >= 10 ? 1.04 : 1);           // 億円/年：容量あたりの架空の単価
  const shares = [52 - p * 0.4, 31 + p * 0.25, 17 + p * 0.15];
  out('mwOut', p); out('mwhOut', mwh); out('capex', capex.toFixed(1)); out('rev', rev.toFixed(1)); out('yield', (rev / capex * 100).toFixed(1));
  bars.forEach((b, i) => { b.style.flexGrow = shares[i].toFixed(1); });
  mw.style.setProperty('--fill', `${((p - 2) / 18) * 100}%`);
}
mw.addEventListener('input', calc); calc();

// ===== 7. 浮いた資料請求ボタン：最初の画面を過ぎたら出す =====
const float = document.querySelector('.float-cta');
ScrollTrigger.create({ trigger: '.stats', start: 'top bottom', endTrigger: '.contact', end: 'top 80%', toggleClass: { targets: float, className: 'is-shown' } });

addEventListener('load', () => ScrollTrigger.refresh());
