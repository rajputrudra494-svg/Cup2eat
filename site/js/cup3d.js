/* --------------------------------------------------------------------------
   Cup2Eat — the cup, in 3D.
   Everything here is procedural: the wafer body is a lathe with real flutes
   pushed into the geometry, the toasty surface + debossed badge are painted
   on canvas, and the bites are carved out in the fragment shader.
   -------------------------------------------------------------------------- */
import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';

// ---- cup dimensions (world units) ----
const H = 1.9;          // height
const R_TOP = 1.0;      // outer radius at rim
const R_BOT = 0.74;     // outer radius at base
const T = 0.075;        // wall thickness
const RIBS = 30;        // flutes around the cup
const SEG = 240;        // radial segments

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const rOut = (y) => lerp(R_BOT, R_TOP, y / H);
const rIn = (y) => rOut(y) - T;

const FLAVOURS = {
  vanilla:   { color: new THREE.Color('#dcaa66'), inner: new THREE.Color('#c9934f'), rough: 0.8,  coat: 0.0 },
  chocolate: { color: new THREE.Color('#5b321e'), inner: new THREE.Color('#4a2817'), rough: 0.5,  coat: 0.35 },
  elaichi:   { color: new THREE.Color('#b5ad66'), inner: new THREE.Color('#a39a55'), rough: 0.8,  coat: 0.0 },
  rim:       { color: new THREE.Color('#dcaa66'), inner: new THREE.Color('#c9934f'), rough: 0.8,  coat: 0.0, rim: true },
};

// chocolate dipped over the lip, with a few lazy drips down the outside
function chocoRimGeometry() {
  const pts = [];
  const vStart = 0.79, N = 14;
  const lip = (y) => rOut(y) + 0.018 * smooth(0.83, 0.9, y / H) + 0.016;
  for (let i = 0; i <= N; i++) {
    const y = H * lerp(vStart, 1, i / N);
    pts.push(new THREE.Vector2(lip(y), y));
  }
  // over the top
  const ro = lip(H), ri = R_TOP - T - 0.012;
  for (let i = 1; i < 10; i++) {
    const a = (i / 10) * Math.PI;
    pts.push(new THREE.Vector2((ro + ri) / 2 + Math.cos(a) * (ro - ri) / 2, H + 0.012 + Math.sin(a) * (ro - ri) * 0.48));
  }
  // and a little way down the inside
  for (let i = 0; i <= 6; i++) {
    const y = H - (i / 6) * 0.2;
    pts.push(new THREE.Vector2(rIn(y) - 0.012, y));
  }
  const geo = new THREE.LatheGeometry(pts, SEG, Math.PI, Math.PI * 2);
  const p = geo.attributes.position;
  const perRing = pts.length;
  for (let i = 0; i < p.count; i++) {
    const j = i % perRing;
    if (j > 4) continue;
    const x = p.getX(i), z = p.getZ(i);
    const phi = Math.atan2(x, z);
    const drip = Math.max(0, Math.sin(phi * 5 + 1.3) * 0.55 + Math.sin(phi * 13 + 0.4) * 0.35 + 0.05);
    p.setY(i, p.getY(i) - Math.pow(drip, 1.6) * 0.22 * (1 - j / 5));
  }
  geo.computeVertexNormals();
  return geo;
}

/* ======================= textures ======================= */

function rand(a, b) { return a + Math.random() * (b - a); }

function waferTextures(fontFamily) {
  const W = 2048, HC = 1024;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = HC; return c; };
  const map = mk(), bump = mk();
  const m = map.getContext('2d'), b = bump.getContext('2d');

  m.fillStyle = '#f1e6d4'; m.fillRect(0, 0, W, HC);
  b.fillStyle = 'rgb(128,128,128)'; b.fillRect(0, 0, W, HC);

  // toasted mottling
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * W, y = Math.random() * HC, r = rand(3, 26);
    const g = m.createRadialGradient(x, y, 0, x, y, r);
    const a = rand(0.03, 0.11);
    g.addColorStop(0, `rgba(${(110 + Math.random() * 40) | 0},${(62 + Math.random() * 25) | 0},26,${a})`);
    g.addColorStop(1, 'rgba(110,62,26,0)');
    m.fillStyle = g; m.beginPath(); m.arc(x, y, r, 0, Math.PI * 2); m.fill();
  }
  // fine speckle + pits in bump
  for (let i = 0; i < 16000; i++) {
    const x = Math.random() * W, y = Math.random() * HC, r = rand(0.5, 1.8);
    m.fillStyle = `rgba(90,50,20,${rand(0.08, 0.3)})`;
    m.beginPath(); m.arc(x, y, r, 0, Math.PI * 2); m.fill();
    const v = Math.random() < 0.5 ? (95 + Math.random() * 20) : (140 + Math.random() * 25);
    b.fillStyle = `rgba(${v | 0},${v | 0},${v | 0},.6)`;
    b.beginPath(); b.arc(x, y, r * 1.3, 0, Math.PI * 2); b.fill();
  }
  // bake lines (horizontal, slightly wavy)
  for (let y = 4; y < HC; y += rand(7, 13)) {
    m.strokeStyle = `rgba(120,70,30,${rand(0.03, 0.08)})`;
    b.strokeStyle = `rgba(105,105,105,${rand(0.25, 0.5)})`;
    m.lineWidth = b.lineWidth = rand(1, 2.2);
    m.beginPath(); b.beginPath();
    const amp = rand(0.5, 2.5), f = rand(0.004, 0.012), ph = rand(0, 6);
    for (let x = 0; x <= W; x += 16) {
      const yy = y + Math.sin(x * f + ph) * amp;
      if (x === 0) { m.moveTo(x, yy); b.moveTo(x, yy); } else { m.lineTo(x, yy); b.lineTo(x, yy); }
    }
    m.stroke(); b.stroke();
  }
  // darker toast toward the base and right under the lip
  let g = m.createLinearGradient(0, HC, 0, HC * 0.7);
  g.addColorStop(0, 'rgba(105,55,18,.35)'); g.addColorStop(1, 'rgba(105,55,18,0)');
  m.fillStyle = g; m.fillRect(0, HC * 0.7, W, HC * 0.3);
  const lipY = HC * (1 - 0.83);
  g = m.createLinearGradient(0, lipY - 18, 0, lipY + 18);
  g.addColorStop(0, 'rgba(105,55,18,0)'); g.addColorStop(.5, 'rgba(105,55,18,.28)'); g.addColorStop(1, 'rgba(105,55,18,0)');
  m.fillStyle = g; m.fillRect(0, lipY - 18, W, 36);
  g = m.createLinearGradient(0, 0, 0, HC * 0.08);
  g.addColorStop(0, 'rgba(105,55,18,.22)'); g.addColorStop(1, 'rgba(105,55,18,0)');
  m.fillStyle = g; m.fillRect(0, 0, W, HC * 0.08);

  // debossed badge, front and centre (u = .5 faces the camera)
  const v = 0.47, rAt = lerp(R_BOT, R_TOP, v);
  const pxU = W / (Math.PI * 2 * rAt), pxV = HC / H;   // px per world unit
  const drawBadge = (ctx, stroke, fill, blur) => {
    ctx.save();
    ctx.translate(W * 0.5, HC * (1 - v));
    ctx.scale(pxU / 100, pxV / 100);   // 100 = 1 world unit
    ctx.filter = `blur(${blur}px)`;
    ctx.strokeStyle = stroke; ctx.fillStyle = fill;
    ctx.lineWidth = 4.2;
    ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, 35, 0, Math.PI * 2); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 19px ${fontFamily}`;
    ctx.fillText('CUP', 0, -14);
    ctx.fillText('EAT', 0, 19);
    ctx.font = `800 12px ${fontFamily}`;
    ctx.fillText('2', 0, 2.5);
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-28, 2.5); ctx.lineTo(-8, 2.5); ctx.moveTo(8, 2.5); ctx.lineTo(28, 2.5); ctx.stroke();
    ctx.restore();
  };
  drawBadge(b, 'rgb(40,40,40)', 'rgb(40,40,40)', 2.2);
  drawBadge(m, 'rgba(95,52,18,.32)', 'rgba(95,52,18,.32)', 1.2);

  return { map, bump };
}

function liquidTexture(kind) {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), R = S / 2;
  x.translate(R, R);
  if (kind === 'chai') {
    let g = x.createRadialGradient(-40, -50, 10, 0, 0, R);
    g.addColorStop(0, '#c48a52'); g.addColorStop(.65, '#ad7140'); g.addColorStop(1, '#8e5a30');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, R, 0, Math.PI * 2); x.fill();
    // lazy swirl from the pour
    x.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      x.strokeStyle = `rgba(236,203,160,${rand(.12, .28)})`; x.lineWidth = rand(4, 12);
      const r = rand(60, 200), s = rand(0, 6);
      x.beginPath(); x.arc(rand(-15, 15), rand(-15, 15), r, s, s + rand(1.2, 2.6)); x.stroke();
    }
    // foam clinging to the rim
    for (let i = 0; i < 900; i++) {
      const a = Math.random() * Math.PI * 2, rr = R * rand(.8, .99), r = rand(1.5, 7);
      x.fillStyle = `rgba(244,222,190,${rand(.2, .6)})`;
      x.beginPath(); x.arc(Math.cos(a) * rr, Math.sin(a) * rr, r, 0, Math.PI * 2); x.fill();
    }
    // masala specks
    for (let i = 0; i < 70; i++) {
      x.fillStyle = `rgba(80,42,18,${rand(.3, .7)})`;
      x.beginPath(); x.arc(rand(-R * .75, R * .75), rand(-R * .75, R * .75), rand(.8, 2.4), 0, Math.PI * 2); x.fill();
    }
  } else {
    let g = x.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, '#7a4728'); g.addColorStop(.7, '#5c331c'); g.addColorStop(.86, '#9b6236'); g.addColorStop(1, '#6a3a1e');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, R, 0, Math.PI * 2); x.fill();
    // tulip: three stacked blobs, then the pull-through
    const milk = '#f3e4c9';
    const blob = (cy, rx, ry) => {
      x.fillStyle = 'rgba(150,95,55,.35)'; x.beginPath(); x.ellipse(0, cy + 4, rx + 6, ry + 5, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = milk; x.beginPath(); x.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2); x.fill();
    };
    blob(70, 128, 88);
    blob(-28, 96, 64);
    blob(-104, 64, 44);
    x.strokeStyle = '#6b3d22'; x.lineWidth = 7; x.lineCap = 'round';
    x.beginPath(); x.moveTo(0, -150); x.quadraticCurveTo(4, 30, 0, 170); x.stroke();
    // micro-foam texture
    for (let i = 0; i < 1500; i++) {
      x.fillStyle = `rgba(255,255,255,${rand(.02, .08)})`;
      x.beginPath(); x.arc(rand(-R, R), rand(-R, R), rand(.5, 2), 0, Math.PI * 2); x.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function radialTexture(stops, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ======================= geometry ======================= */

function outerWallGeometry() {
  const pts = [];
  // rounded heel
  for (let i = 0; i <= 6; i++) {
    const a = (-Math.PI / 2) + (i / 6) * (Math.PI / 2);
    const rc = 0.06;
    pts.push(new THREE.Vector2(R_BOT - rc + Math.cos(a) * rc, rc + Math.sin(a) * rc));
  }
  const N = 90;
  for (let i = 1; i <= N; i++) {
    const y = 0.06 + (H - 0.06) * (i / N);
    pts.push(new THREE.Vector2(rOut(y), y));
  }
  const geo = new THREE.LatheGeometry(pts, SEG, Math.PI, Math.PI * 2);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const phi = Math.atan2(x, z);
    const v = y / H;
    const band = smooth(0.05, 0.12, v) * (1 - smooth(0.78, 0.83, v));
    const rib = Math.pow(0.5 + 0.5 * Math.cos(phi * RIBS), 1.6);
    let r2 = r + 0.03 * band * rib - 0.012 * band;
    r2 += 0.018 * smooth(0.83, 0.9, v);                         // the lip
    r2 += 0.004 * Math.sin(phi * 3 + y * 5) + 0.003 * Math.sin(phi * 7 - y * 3); // hand-made wobble
    p.setXYZ(i, Math.sin(phi) * r2, y, Math.cos(phi) * r2);
    uv.setY(i, v);
  }
  geo.computeVertexNormals();
  return geo;
}

function innerWallGeometry() {
  const pts = [];
  const N = 60, y0 = 0.12;
  for (let i = N; i >= 0; i--) {
    const y = y0 + (H - y0) * (i / N);
    pts.push(new THREE.Vector2(rIn(y), y));
  }
  const geo = new THREE.LatheGeometry(pts, 160, Math.PI, Math.PI * 2);
  const uv = geo.attributes.uv, p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) uv.setY(i, p.getY(i) / H);
  return geo;
}

function rimGeometry() {
  const ro = R_TOP + 0.018, ri = R_TOP - T;
  const c = (ro + ri) / 2, rr = (ro - ri) / 2;
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI;
    pts.push(new THREE.Vector2(c + Math.cos(a) * rr, H + Math.sin(a) * rr * 0.9));
  }
  return new THREE.LatheGeometry(pts, SEG, Math.PI, Math.PI * 2);
}

/* ======================= bite shader ======================= */

function biteMaterial(params, uniforms) {
  const mat = new THREE.MeshPhysicalMaterial(params);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uBites = uniforms.uBites;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCupPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCupPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vCupPos;
        uniform vec4 uBites[3];
        float biteEdge = 0.0;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        for (int i = 0; i < 3; i++) {
          vec4 b = uBites[i];
          if (b.w <= 0.0) continue;
          vec3 d = vCupPos - b.xyz;
          vec2 tang = normalize(vec2(-b.z, b.x));
          float a = atan(d.y, dot(d.xz, tang));
          float r = b.w * (1.0 + 0.075 * sin(a * 9.0) + 0.03 * sin(a * 23.0));
          float len = length(d);
          if (len < r) discard;
          biteEdge = max(biteEdge, 1.0 - smoothstep(r, r * 1.12, len));
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        diffuseColor.rgb *= mix(1.0, 0.68, biteEdge);`);
  };
  return mat;
}

/* ======================= ice cream ======================= */

function hash3(x, y, z) { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t);
  const u = s(xf), v = s(yf), w = s(zf);
  let n = 0;
  for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) {
    n += hash3(xi + dx, yi + dy, zi + dz) * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
  }
  return n;
}

function makeIceCream() {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.84, 160, 120);
  const p = geo.attributes.position, n = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    n.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const lon = Math.atan2(n.z, n.x);
    let d = 1
      + 0.07 * (vnoise(n.x * 2.4 + 3, n.y * 2.4, n.z * 2.4) - 0.5)
      + 0.03 * (vnoise(n.x * 7, n.y * 7 + 9, n.z * 7) - 0.5)
      + 0.05 * Math.exp(-Math.pow((n.y + 0.12) / 0.12, 2)) * (0.6 + 0.4 * Math.sin(lon * 5 + n.y * 4)); // scooped curl
    let y = n.y * 0.84 * d * 0.86;
    if (y < -0.3) y = -0.3 + (y + 0.3) * 0.25;
    p.setXYZ(i, n.x * 0.84 * d, y, n.z * 0.84 * d);
  }
  geo.computeVertexNormals();
  const cream = new THREE.MeshPhysicalMaterial({ color: '#d9bf92', roughness: 0.78, sheen: 0.25, sheenColor: new THREE.Color('#f5e3c0'), envMapIntensity: 0.35 });
  g.add(new THREE.Mesh(geo, cream));

  const choc = new THREE.MeshPhysicalMaterial({ color: '#3a1d0f', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 });
  for (let k = 0; k < 3; k++) {
    const pts = [];
    const off = k * 2.1 + Math.random();
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const lat = lerp(1.25, 0.05, t) + Math.sin(t * 9 + k) * 0.05;
      const lon = off + t * 3.6;
      const dir = new THREE.Vector3(Math.cos(lon) * Math.cos(lat), Math.sin(lat), Math.sin(lon) * Math.cos(lat));
      pts.push(dir.multiplyScalar(0.86).multiply(new THREE.Vector3(1, 0.78, 1)));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 140, 0.032 - k * 0.004, 10, false);
    g.add(new THREE.Mesh(tube, choc));
  }
  const nutMat = new THREE.MeshStandardMaterial({ color: '#c99a5c', roughness: 0.7 });
  const nutGeo = new THREE.DodecahedronGeometry(0.045, 0);
  for (let i = 0; i < 34; i++) {
    const lat = rand(0.35, 1.45), lon = rand(0, Math.PI * 2);
    const m = new THREE.Mesh(nutGeo, nutMat);
    m.position.set(Math.cos(lon) * Math.cos(lat), Math.sin(lat), Math.sin(lon) * Math.cos(lat)).multiplyScalar(0.86).multiply(new THREE.Vector3(1, 0.76, 1));
    m.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
    m.scale.set(rand(.6, 1.3), rand(.4, .8), rand(.6, 1.2));
    g.add(m);
  }
  return g;
}

/* ======================= scene ======================= */

export async function createCup(canvas) {
  try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
  const fontFamily = document.fonts && document.fonts.check('800 20px Fraunces') ? 'Fraunces' : 'Georgia';

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 4.1, 9.0);
  camera.lookAt(0, 0.12, 0);

  const key = new THREE.DirectionalLight('#fff0d9', 2.4); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight('#f1cf86', 2.6); rim.position.set(-4, 2.5, -3); scene.add(rim);
  const fill = new THREE.HemisphereLight('#fff8ec', '#3b2a18', 0.45); scene.add(fill);

  // hierarchy: anchor (move/scale) > tilt > spin > cup (centred)
  const anchor = new THREE.Group(); scene.add(anchor);
  const tilt = new THREE.Group(); anchor.add(tilt);
  const spin = new THREE.Group(); tilt.add(spin);
  const cupG = new THREE.Group(); cupG.position.y = -H / 2; spin.add(cupG);

  // --- materials ---
  const tex = waferTextures(fontFamily);
  const map = new THREE.CanvasTexture(tex.map); map.colorSpace = THREE.SRGBColorSpace;
  const bump = new THREE.CanvasTexture(tex.bump);
  [map, bump].forEach(t => { t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.wrapS = THREE.RepeatWrapping; });

  const uniforms = { uBites: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] } };
  const start = FLAVOURS.vanilla;
  const outerMat = biteMaterial({ color: start.color.clone(), map, bumpMap: bump, bumpScale: 2.2, roughness: start.rough, clearcoat: start.coat, clearcoatRoughness: 0.4, envMapIntensity: 0.6, sheen: 0.4, sheenRoughness: 0.8, sheenColor: new THREE.Color('#ffdcae') }, uniforms);
  const innerMat = biteMaterial({ color: start.inner.clone(), map, bumpMap: bump, bumpScale: 1.4, roughness: 0.85, envMapIntensity: 0.4, side: THREE.DoubleSide }, uniforms);
  const rimMat = biteMaterial({ color: start.color.clone(), map, bumpMap: bump, bumpScale: 1, roughness: 0.75, envMapIntensity: 0.6 }, uniforms);

  const outer = new THREE.Mesh(outerWallGeometry(), outerMat);
  const inner = new THREE.Mesh(innerWallGeometry(), innerMat);
  const rimM = new THREE.Mesh(rimGeometry(), rimMat);
  const base = new THREE.Mesh(new THREE.CircleGeometry(R_BOT - 0.06, 64), outerMat);
  base.rotation.x = Math.PI / 2;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(rIn(0.12), 64), innerMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.12;
  cupG.add(outer, inner, rimM, base, floor);

  const chocoMat = biteMaterial({ color: '#3a1d0f', roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.18, envMapIntensity: 0.8, side: THREE.DoubleSide }, uniforms);
  const choco = new THREE.Mesh(chocoRimGeometry(), chocoMat);
  choco.visible = false;
  cupG.add(choco);

  // --- liquid ---
  const liqTex = { chai: liquidTexture('chai'), coffee: liquidTexture('coffee') };
  const liquidMat = new THREE.MeshPhysicalMaterial({ map: liqTex.chai, roughness: 0.3, clearcoat: 0.55, clearcoatRoughness: 0.12, envMapIntensity: 0.35 });
  const liquid = new THREE.Mesh(new THREE.CircleGeometry(1, 96), liquidMat);
  cupG.add(liquid);
  const qFlat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const qTmp = new THREE.Quaternion();

  // --- ice cream ---
  const ice = makeIceCream();
  ice.position.y = H + 0.08;
  ice.scale.setScalar(0.001);
  ice.visible = false;
  cupG.add(ice);

  // --- steam ---
  const steamTex = radialTexture([[0, 'rgba(255,255,255,.55)'], [.4, 'rgba(255,255,255,.18)'], [1, 'rgba(255,255,255,0)']], 128);
  const steam = [];
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData = { phase: i / 14, x: rand(-0.35, 0.35), z: rand(-0.25, 0.25), spd: rand(0.11, 0.17), w: rand(0.5, 1.4) };
    cupG.add(s); steam.push(s);
  }

  // --- soft contact shadow (doesn't rotate with the cup) ---
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 3.4),
    new THREE.MeshBasicMaterial({ map: radialTexture([[0, 'rgba(25,15,6,.55)'], [.45, 'rgba(25,15,6,.22)'], [1, 'rgba(25,15,6,0)']]), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -H / 2 - 0.02;
  anchor.add(shadow);

  // --- crumbs ---
  const CRUMBS = 90;
  const crumbMat = new THREE.MeshStandardMaterial({ color: start.color.clone(), roughness: 0.85 });
  const crumbs = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.05, 0), crumbMat, CRUMBS);
  crumbs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(crumbs);
  const crumbData = Array.from({ length: CRUMBS }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), s: 1 }));
  const dummy = new THREE.Object3D();
  let crumbCursor = 0;
  const hideAllCrumbs = () => { dummy.scale.setScalar(0); dummy.updateMatrix(); for (let i = 0; i < CRUMBS; i++) crumbs.setMatrixAt(i, dummy.matrix); crumbs.instanceMatrix.needsUpdate = true; };
  hideAllCrumbs();

  // bite placement (cup-local): right shoulder first, working round to the front
  const BITE_PHI = [1.15, 0.5, -0.2];
  const BITE_AT = [0.12, 0.45, 0.78];
  const biteCentre = (k) => new THREE.Vector3(Math.sin(BITE_PHI[k]) * (R_TOP + 0.07), H + 0.07, Math.cos(BITE_PHI[k]) * (R_TOP + 0.07));
  const biteDone = [false, false, false];

  function spawnCrumbs(k) {
    const local = biteCentre(k);
    local.y -= 0.12;
    const world = cupG.localToWorld(local.clone());
    const outward = world.clone().sub(anchor.getWorldPosition(new THREE.Vector3())).setY(0).normalize();
    for (let i = 0; i < 18; i++) {
      const c = crumbData[crumbCursor]; crumbCursor = (crumbCursor + 1) % CRUMBS;
      c.life = 1;
      c.p.copy(world).add(new THREE.Vector3(rand(-.12, .12), rand(-.05, .08), rand(-.12, .12)).multiplyScalar(anchor.scale.x));
      c.v.copy(outward).multiplyScalar(rand(0.6, 2.2)).add(new THREE.Vector3(rand(-.8, .8), rand(0.8, 2.6), rand(-.4, 1.2))).multiplyScalar(anchor.scale.x);
      c.r.set(rand(0, 6), rand(0, 6), rand(0, 6));
      c.s = rand(0.5, 1.4) * anchor.scale.x;
    }
  }

  /* ---------------- public state ---------------- */
  const state = {
    target: { x: 0.45, y: -0.02, s: 1, rotY: -0.35, rotX: 0.08, rotZ: 0, fill: 0.82, bite: 0, opacity: 1, steam: 1, sway: 1, spinScroll: 0 },
    intro: 0,
    pointer: { x: 0, y: 0 },
    dragVel: 0,
    flavour: 'vanilla',
    drink: 'chai',
  };
  const cur = { ...state.target };
  let spinKick = 0, spinKickCur = 0, dragAngle = 0, iceScale = 0, liquidVis = 1;
  const targetColor = start.color.clone(), targetInner = start.inner.clone();
  let targetRough = start.rough, targetCoat = start.coat;

  function setFlavour(name) {
    if (!FLAVOURS[name] || name === state.flavour) return;
    state.flavour = name;
    const f = FLAVOURS[name];
    targetColor.copy(f.color); targetInner.copy(f.inner); targetRough = f.rough; targetCoat = f.coat;
    spinKick += Math.PI * 2;
    // swap the coating mid-spin so the change reads as a "new cup", not a pop
    setTimeout(() => { choco.visible = !!f.rim; }, 260);
  }
  function setDrink(name) {
    if (name === state.drink) return;
    state.drink = name;
    if (name === 'chai' || name === 'coffee') liquidMat.map = liqTex[name], liquidMat.needsUpdate = true;
  }

  /* ---------------- sizing ---------------- */
  let visW = 1, visH = 1;
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const dist = camera.position.length();
    visH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist;
    visW = visH * camera.aspect;
  }
  resize();
  window.addEventListener('resize', resize);

  /* ---------------- loop ---------------- */
  const clock = new THREE.Clock();
  let raf = 0;
  const easeOutBack = (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const k = 1 - Math.exp(-dt * 7);
    const tg = state.target;

    if (state.snap) { Object.assign(cur, tg); state.snap = false; }
    for (const key in tg) cur[key] += (tg[key] - cur[key]) * k;
    // bite + fill react a touch faster, so scrubbing feels connected
    cur.bite += (tg.bite - cur.bite) * (1 - Math.exp(-dt * 14));

    canvas.style.opacity = cur.opacity.toFixed(3);
    if (cur.opacity < 0.01 && state.intro > 0.99) { return; }

    // placement
    const unit = Math.min(visH, visW * 1.25) / 5;
    const intro = easeOutBack(Math.min(1, state.intro));
    anchor.position.set(cur.x * visW / 2, cur.y * visH / 2 + (1 - Math.min(1, state.intro)) * -0.6, 0);
    anchor.scale.setScalar(Math.max(0.0001, cur.s * unit * intro));

    // rotation
    dragAngle += state.dragVel * dt;
    state.dragVel *= Math.pow(0.04, dt);
    spinKickCur += (spinKick - spinKickCur) * (1 - Math.exp(-dt * 3.2));
    const sway = cur.sway;
    spin.rotation.y = cur.rotY + cur.spinScroll + dragAngle + spinKickCur
      + sway * (Math.sin(t * 0.45) * 0.38 + state.pointer.x * 0.4)
      + (1 - Math.min(1, state.intro)) * -2.4;
    tilt.rotation.x = cur.rotX + sway * (Math.sin(t * 0.7) * 0.03 + state.pointer.y * 0.12);
    tilt.rotation.z = cur.rotZ + sway * Math.sin(t * 0.55) * 0.025;
    anchor.position.y += sway * Math.sin(t * 0.9) * 0.05 * anchor.scale.x;

    // flavour colours
    outerMat.color.lerp(targetColor, k * 0.8);
    rimMat.color.lerp(targetColor, k * 0.8);
    innerMat.color.lerp(targetInner, k * 0.8);
    crumbMat.color.copy(outerMat.color);
    outerMat.roughness += (targetRough - outerMat.roughness) * k;
    outerMat.clearcoat += (targetCoat - outerMat.clearcoat) * k;

    // drink
    const wantIce = state.drink === 'icecream';
    iceScale += ((wantIce ? 1 : 0) - iceScale) * (1 - Math.exp(-dt * 6));
    ice.visible = iceScale > 0.01;
    const sIce = wantIce ? easeOutBack(Math.min(1, iceScale * 1.02)) : iceScale;
    ice.scale.setScalar(Math.max(0.001, sIce));
    ice.rotation.y = t * 0.15;
    liquidVis += ((wantIce ? 0.4 : 1) - liquidVis) * k;

    const fill = Math.max(0, cur.fill) * liquidVis;
    const ly = lerp(0.14, H - 0.16, fill);
    liquid.visible = fill > 0.015;
    liquid.position.y = ly;
    liquid.scale.setScalar(rIn(ly) - 0.004);
    tilt.updateMatrixWorld(true);
    qTmp.copy(tilt.quaternion).multiply(spin.quaternion).invert();
    liquid.quaternion.copy(qTmp).multiply(qFlat);

    // steam
    const steamAmt = cur.steam * (wantIce ? 0 : 1) * smooth(0.25, 0.6, fill);
    for (const s of steam) {
      const u = s.userData;
      const life = (t * u.spd + u.phase) % 1;
      s.position.set(u.x + Math.sin(t * 0.8 + u.phase * 9) * 0.18 * life, ly + 0.1 + life * 1.9, u.z);
      const sc = 0.35 + life * 1.1 * u.w;
      s.scale.set(sc, sc * 1.3, 1);
      s.material.opacity = Math.sin(Math.PI * life) * 0.22 * steamAmt;
      s.material.rotation = u.phase * 6 + t * 0.1;
    }

    // bites
    for (let i = 0; i < 3; i++) {
      const p = smooth(BITE_AT[i], BITE_AT[i] + 0.05, cur.bite);
      const c = biteCentre(i);
      uniforms.uBites.value[i].set(c.x, c.y, c.z, p > 0.001 ? 0.38 * (0.55 + 0.45 * p) : 0);
      const crossed = cur.bite > BITE_AT[i] + 0.02;
      if (crossed && !biteDone[i]) { biteDone[i] = true; spawnCrumbs(i); }
      if (!crossed && biteDone[i] && cur.bite < BITE_AT[i] - 0.02) biteDone[i] = false;
    }

    // crumbs
    let anyCrumb = false;
    const floorY = anchor.position.y - (H / 2) * anchor.scale.x - 0.02;
    for (let i = 0; i < CRUMBS; i++) {
      const c = crumbData[i];
      if (c.life <= 0) continue;
      anyCrumb = true;
      c.life -= dt * 0.55;
      c.v.y -= 9.8 * dt * anchor.scale.x;
      c.p.addScaledVector(c.v, dt);
      if (c.p.y < floorY) { c.p.y = floorY; c.v.multiplyScalar(0.35); c.v.y = Math.abs(c.v.y) * 0.3; }
      c.r.x += dt * 4; c.r.y += dt * 3;
      dummy.position.copy(c.p); dummy.rotation.copy(c.r);
      dummy.scale.setScalar(c.s * Math.min(1, c.life * 3) * 0.9);
      dummy.updateMatrix();
      crumbs.setMatrixAt(i, dummy.matrix);
      if (c.life <= 0) { dummy.scale.setScalar(0); dummy.updateMatrix(); crumbs.setMatrixAt(i, dummy.matrix); }
    }
    if (anyCrumb) crumbs.instanceMatrix.needsUpdate = true;

    shadow.material.opacity = 0.9 - Math.abs(cur.rotZ) * 0.6;

    renderer.render(scene, camera);
  }
  frame();

  return {
    state,
    setFlavour,
    setDrink,
    resize,
    dispose() { cancelAnimationFrame(raf); renderer.dispose(); },
  };
}
