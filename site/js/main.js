/* --------------------------------------------------------------------------
   Cup2Eat — page behaviour
   -------------------------------------------------------------------------- */
import { createCup } from './cup3d.js?v=3';

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => window.innerWidth <= 820;

const WA = '919818192575';
const waLink = (msg) => `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;

/* ---------------- smooth scroll ---------------- */
let lenis = null;
if (!reduceMotion && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95 });
  lenis.stop();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

// in-page anchors go through Lenis so they glide instead of jump
$$('a[href^="#"]').forEach(a => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  const el = id === '#top' ? document.body : $(id);
  if (!el) return;
  e.preventDefault();
  closeMenu();
  if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.6 }); else el.scrollIntoView({ behavior: 'smooth' });
}));

/* ---------------- text splitting ---------------- */
function splitWords(el) {
  const walk = (node, out) => {
    node.childNodes.forEach(n => {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) out.push(document.createTextNode(' '));
          else { const w = document.createElement('span'); w.className = 'w'; w.innerHTML = `<span>${part}</span>`; out.push(w); }
        });
      } else if (n.nodeName === 'BR') {
        out.push(n.cloneNode());
      } else {
        const clone = n.cloneNode(false); const inner = []; walk(n, inner); inner.forEach(c => clone.appendChild(c));
        // keep emphasis styling, but split inside it
        out.push(clone);
      }
    });
  };
  const out = []; walk(el, out);
  el.innerHTML = ''; out.forEach(n => el.appendChild(n));
  $$('.w', el).forEach((w, i) => w.style.setProperty('--i', i));
  return $$('.w', el);
}

$$('.h2').forEach(h => { splitWords(h); h.classList.add('split'); });

// manifesto: words light up as you read
const manifesto = $('[data-scrub-words]');
if (manifesto) {
  const words = splitWords(manifesto);
  words.forEach(w => { w.style.overflow = 'visible'; w.firstChild.style.transform = 'none'; });
  ScrollTrigger.create({
    trigger: manifesto, start: 'top 80%', end: 'bottom 45%', scrub: true,
    onUpdate: (st) => {
      const n = st.progress * words.length;
      words.forEach((w, i) => { w.style.opacity = (0.14 + 0.86 * clamp01(n - i)).toFixed(3); });
    },
  });
}

// footer letters
const big = $('[data-wobble]');
if (big) {
  big.innerHTML = big.textContent.split('').map(c => c === ' ' ? ' ' : `<span class="ch">${c}</span>`).join('');
}

/* ---------------- reveals ---------------- */
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { rootMargin: '0px 0px -12% 0px' });
$$('.split, [data-reveal]').forEach(el => io.observe(el));

/* ---------------- nav ---------------- */
const nav = $('[data-nav]');
const sections = $$('[data-theme]');
let lastY = 0;
function updateNav(y) {
  nav.classList.toggle('is-scrolled', y > 40);
  if (!nav.classList.contains('menu-open')) nav.classList.toggle('is-hidden', y > lastY && y > 400);
  lastY = y;
  const probe = 34;
  for (const s of sections) {
    const r = s.getBoundingClientRect();
    if (r.top <= probe && r.bottom > probe) { nav.classList.toggle('is-light', s.dataset.theme === 'light'); break; }
  }
}
function closeMenu() {}

/* ---------------- Kulhu, the mascot ---------------- */
const kulhuTpl = $('#kulhu-tpl');
$$('[data-kulhu]').forEach((el, idx) => {
  el.appendChild(kulhuTpl.content.cloneNode(true));
  // blink out of sync so they don't all look like clones
  el.style.setProperty('--blink-delay', (idx * 0.73 % 3.1).toFixed(2) + 's');
  const lines = (el.dataset.say || '').split('|').filter(Boolean);
  if (!lines.length) return;
  const bubble = document.createElement('span');
  bubble.className = 'kulhu__bubble';
  bubble.textContent = lines[0];
  el.appendChild(bubble);
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', 'Kulhu the Cup2Eat mascot says: ' + lines[0]);
  let i = 0;
  const talk = () => {
    i = (i + 1) % lines.length;
    bubble.textContent = lines[i];
    el.setAttribute('aria-label', 'Kulhu the Cup2Eat mascot says: ' + lines[i]);
    gsap.fromTo(bubble, { scale: 0.6, rotate: -8 }, { scale: 1, rotate: 0, duration: 0.6, ease: 'elastic.out(1, .5)' });
    gsap.fromTo(el.querySelector('.kulhu__svg'), { y: 0 }, { y: -18, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' });
  };
  el.addEventListener('click', talk);
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); talk(); } });
  ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => el.classList.add('is-talking') });
});

/* ---------------- bottom dock ---------------- */
const dock = $('[data-dock]');
const dockLinks = $$('[data-spy]', dock);
const dockBlob = $('.dock__blob', dock);
const spyTargets = dockLinks.map(a => (a.dataset.spy === 'top' ? $('.hero') : $('#' + a.dataset.spy)));
let activeSpy = -1;
function updateDock() {
  const probe = window.innerHeight * 0.45;
  let idx = 0;
  spyTargets.forEach((s, i) => { if (s && s.getBoundingClientRect().top <= probe) idx = i; });
  if (idx === activeSpy) return;
  activeSpy = idx;
  dockLinks.forEach((a, i) => a.classList.toggle('is-active', i === idx));
  const a = dockLinks[idx], dr = dock.getBoundingClientRect(), r = a.getBoundingClientRect();
  gsap.to(dockBlob, { x: r.left - dr.left, width: r.width, duration: 0.6, ease: 'elastic.out(1, .75)' });
}
window.addEventListener('resize', () => { activeSpy = -1; updateDock(); });

/* ---------------- doodle parallax ---------------- */
$$('[data-speed]').forEach(d => {
  const sp = parseFloat(d.dataset.speed);
  gsap.to(d, { y: () => sp * -160, rotate: sp * 40, ease: 'none', scrollTrigger: { trigger: d.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
});

/* ---------------- WhatsApp links ---------------- */
$$('[data-wa]').forEach(a => a.href = waLink("Hi Cup2Eat! I found you through your website and I'd love to know more about the edible cups."));

/* ---------------- wholesale calculator ---------------- */
// prices: regular = Nov 2026 Instagram offer; the rest from their Sept 2026 catalogue
const PRODUCTS = {
  regular: { name: 'Regular edible cup (100 ml)', price: 3999, cups: 396, min: 5, tag: 'Wholesale offer', mix: true },
  cold:    { name: 'Cold edible cup (150 ml)',    price: 6500, cups: 432, min: 1, tag: 'For cold coffee & shakes', mix: false },
  coated:  { name: 'Chocolate-coated cup (100 ml)', price: 4499, cups: 200, min: 1, tag: 'Made for ice cream', mix: false },
  rim:     { name: 'Chocolate-rim cup (100 ml)',  price: 5500, cups: 396, min: 1, tag: 'New in the catalogue', mix: false },
};
const range = $('#boxes');
const fmt = (n) => n.toLocaleString('en-IN');
let product = PRODUCTS.regular;
function updateCalc() {
  const boxes = +range.value;
  const cups = boxes * product.cups, total = boxes * product.price;
  $('[data-boxes]').textContent = boxes;
  $('[data-cups]').textContent = fmt(cups);
  $('[data-total]').textContent = '₹' + fmt(total);
  range.style.setProperty('--p', ((boxes - range.min) / (range.max - range.min) * 100) + '%');
  const mixF = $$('.calc__mix input:checked').map(i => i.value);
  const msg = `Hi Cup2Eat! I'd like to order ${boxes} box${boxes > 1 ? 'es' : ''} (${fmt(cups)} cups) of the ${product.name}.\n` +
    (product.mix ? `Flavours: ${mixF.length ? mixF.join(', ') : 'happy to take your suggestion'}\n` : '') +
    `Total as per your price list: ₹${fmt(total)}\n` +
    `Delivery city: `;
  $('[data-order]').href = waLink(msg);
}
function setProduct(key) {
  product = PRODUCTS[key];
  range.min = product.min;
  if (+range.value < product.min) range.value = product.min;
  $('[data-p-price]').textContent = fmt(product.price);
  const per = product.price / product.cups;
  $('[data-p-per]').innerHTML = `per box of <b>${product.cups} cups</b> &middot; works out to about ₹${per.toFixed(per < 15 ? 0 : 1).replace(/\.0$/, '')} a cup`;
  $('[data-p-min]').textContent = product.min > 1 ? `(minimum ${product.min})` : '';
  $('[data-p-tag]').textContent = product.tag;
  $('.calc__mix').style.display = product.mix ? '' : 'none';
  gsap.fromTo('[data-p-price]', { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: 'expo.out' });
  updateCalc();
}
$$('input[name="product"]').forEach(r => r.addEventListener('change', () => setProduct(r.value)));
range.addEventListener('input', updateCalc);
$$('.calc__mix input').forEach(i => i.addEventListener('change', updateCalc));
updateCalc();

/* ---------------- magnetic buttons + cursor ---------------- */
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
if (fine && !reduceMotion) {
  $$('.magnetic').forEach(btn => {
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      gsap.to(btn, { x: (e.clientX - r.left - r.width / 2) * 0.25, y: (e.clientY - r.top - r.height / 2) * 0.35, duration: 0.5, ease: 'power3.out' });
    });
    btn.addEventListener('pointerleave', () => gsap.to(btn, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, .4)' }));
  });

  const cursor = $('.cursor'), label = $('.cursor__label');
  const xTo = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3' });
  const yTo = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3' });
  window.addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY); });
  document.addEventListener('pointerover', (e) => {
    const drag = e.target.closest('[data-drag]');
    const link = e.target.closest('a, button, summary, label, input');
    cursor.classList.toggle('is-big', !!drag && !link);
    label.textContent = drag && !link ? 'drag' : '';
    cursor.classList.toggle('is-link', !!link);
  });
}

/* ---------------- marquee reacts to scroll speed ---------------- */
const marqueeAnims = $$('.marquee__track').map(t => (t.getAnimations ? t.getAnimations()[0] : null)).filter(Boolean);
let mqRate = 1;

/* ---------------- horizontal "uses" ---------------- */
const mm = gsap.matchMedia();

/* ---------------- acts pin ---------------- */
const acts = $('.acts');
const actItems = $$('.act');
const actsBar = $('.acts__progress i');
const crunch = $('.acts__crunch');
let actsST = null;
let currentAct = 0;

actsST = ScrollTrigger.create({
  trigger: acts,
  start: 'top top',
  end: () => '+=' + Math.round(window.innerHeight * 2.6),
  pin: true,
  scrub: true,
  onUpdate: (st) => {
    const p = st.progress;
    actsBar.style.transform = `scaleX(${p})`;
    const idx = p < 0.34 ? 0 : p < 0.62 ? 1 : 2;
    if (idx !== currentAct) {
      currentAct = idx;
      actItems.forEach((li, i) => li.classList.toggle('is-active', i === idx));
    }
  },
});

mm.add('(min-width: 821px)', () => {
  const track = $('.uses__track');
  const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
  const tween = gsap.to(track, {
    x: () => -dist(),
    ease: 'none',
    scrollTrigger: { trigger: '.uses', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.6, invalidateOnRefresh: true },
  });
  $$('.use__img img').forEach(img => {
    gsap.fromTo(img, { xPercent: -6 }, { xPercent: 6, ease: 'none', scrollTrigger: { trigger: img.parentElement, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
  });

  // polaroids get pinned to the board one by one
  gsap.from('[data-polaroid]', {
    y: 120, rotation: (i) => [-14, 12, -8, 16, -10][i], opacity: 0,
    duration: 1.3, ease: 'expo.out', stagger: 0.12,
    scrollTrigger: { trigger: '.scrapbook', start: 'top 75%' },
  });
});

mm.add('(max-width: 820px)', () => {
  $$('.use__img img').forEach(img => {
    gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
});

// "who" tiles drift slightly
$$('.who li').forEach((li, i) => {
  gsap.from(li, { y: 60, opacity: 0, duration: 1.1, ease: 'expo.out', delay: (i % 2) * 0.1, scrollTrigger: { trigger: li, start: 'top 90%' } });
});
// (timeline items reveal through [data-reveal]; a second GSAP fade here used to leave them invisible)

/* ---------------- 3D cup ---------------- */
const stage = $('.flavours__stage');
const flavoursSec = $('.flavours');
let cup = null;
let lastSeg = null;

function presets() {
  if (isMobile()) {
    return {
      hero: { x: 0, y: 0.42, s: 1.15, rotY: -0.3, rotX: 0.12 },
      acts: { x: 0, y: 0.02, s: 0.82, rotY: -0.45, rotX: 0.16 },
      flav: { s: 0.8 },
    };
  }
  return {
    hero: { x: 0.43, y: -0.06, s: 1.08, rotY: -0.3, rotX: 0.1 },
    acts: { x: 0.42, y: -0.1, s: 1.12, rotY: -0.45, rotX: 0.16 },
    flav: { s: 1.0 },
  };
}

function driveCup() {
  if (!cup) return;
  const vh = window.innerHeight, vw = window.innerWidth;
  const P = presets();
  const t = cup.state.target;
  const actsRect = acts.getBoundingClientRect();
  const flavRect = flavoursSec.getBoundingClientRect();
  const y = window.scrollY;

  let s;
  const seg = actsRect.top > vh * 0.9 ? 'hero' : 'acts';
  if (seg !== lastSeg) { lastSeg && (cup.state.snap = true); lastSeg = seg; }
  if (seg === 'hero') {
    // HERO — cup rides up with the hero as you leave it
    s = { ...P.hero, fill: 0.94, bite: 0, steam: 1, sway: 1, rotZ: 0, spinScroll: y / vh * 1.6 };
    s.y += 2 * y / vh;
  } else {
    // ACTS — while pinned, pour → sip → bite
    const p = actsST ? actsST.progress : 0;
    const pour = smooth(0.02, 0.3, p), sip = smooth(0.36, 0.6, p), bite = smooth(0.66, 0.97, p);
    const sipArc = Math.sin(Math.PI * smooth(0.36, 0.6, p));
    s = {
      ...P.acts,
      fill: 0.94 * pour * (1 - sip),
      bite,
      steam: 1 - sip,
      sway: 0.15 * (1 - bite),
      rotZ: -0.16 * sipArc,
      spinScroll: 0,
    };
    s.rotX += 0.32 * sipArc;
    s.rotY += bite * 0.25 + pour * 0.2;
    s.y -= 2 * actsRect.top / vh;   // enters from below, leaves upward
    if (crunch) {
      const c = smooth(0.7, 0.8, p);
      crunch.style.opacity = c * (1 - smooth(0.98, 1, p) * 0);
      crunch.style.transform = `rotate(8deg) scale(${0.6 + 0.4 * c})`;
    }

    // FLAVOURS — glide over to the stage and follow it
    const blend = smooth(vh * 0.95, vh * 0.25, flavRect.top + (isMobile() ? 0 : vh * 0.15));
    if (blend > 0) {
      const sr = stage.getBoundingClientRect();
      const fx = ((sr.left + sr.width / 2) / vw) * 2 - 1;
      const fy = 1 - ((sr.top + sr.height / 2) / vh) * 2;
      const f = { x: fx, y: fy, s: P.flav.s, rotY: -0.3, rotX: 0.1, rotZ: 0, fill: 0.94, bite: 0, steam: 1, sway: 0.8, spinScroll: blend * Math.PI * 2 };
      for (const k in f) s[k] = mix(s[k] ?? f[k], f[k], blend);
    }
  }
  s.opacity = flavRect.bottom < -40 ? 0 : 1;
  Object.assign(t, s);

  // the hero / acts always show chai; flavours shows what the visitor picked
  const inFlavours = flavRect.top < vh * 0.6;
  cup.setDrink(inFlavours ? chosenDrink : 'chai');
}

let chosenDrink = 'chai';
$$('[data-flavour-btn]').forEach(btn => btn.addEventListener('click', () => {
  const name = btn.dataset.flavourBtn;
  $$('[data-flavour-btn]').forEach(b => { const on = b === btn; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on); });
  $$('[data-flavour-copy]').forEach(a => a.classList.toggle('is-on', a.dataset.flavourCopy === name));
  flavoursSec.dataset.flavour = name;
  cup && cup.setFlavour(name);
}));
$$('[data-drink-btn]').forEach(btn => btn.addEventListener('click', () => {
  chosenDrink = btn.dataset.drinkBtn;
  $$('[data-drink-btn]').forEach(b => b.classList.toggle('is-on', b === btn));
  if (chosenDrink === 'icecream') {
    // ice cream + chocolate-coated cup is the house recommendation
    const choc = $('[data-flavour-btn="chocolate"]');
    if (!choc.classList.contains('is-on')) choc.click();
  }
  cup && cup.setDrink(chosenDrink);
}));

// drag to spin
let dragging = false, lastX = 0;
stage.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; stage.setPointerCapture(e.pointerId); });
stage.addEventListener('pointermove', (e) => {
  if (!dragging || !cup) return;
  const dx = e.clientX - lastX; lastX = e.clientX;
  cup.state.dragVel = dx * 0.55;
});
const endDrag = () => { dragging = false; };
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);

window.addEventListener('pointermove', (e) => {
  if (!cup) return;
  cup.state.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  cup.state.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
});

/* ---------------- per-frame glue ---------------- */
gsap.ticker.add(() => {
  const y = window.scrollY;
  updateNav(y);
  updateDock();
  driveCup();
  if (marqueeAnims.length) {
    const v = lenis ? Math.abs(lenis.velocity) : 0;
    mqRate += ((1 + Math.min(v * 0.12, 4)) - mqRate) * 0.1;
    marqueeAnims.forEach(a => (a.playbackRate = mqRate));
  }
});

/* ---------------- boot: loader → hero ---------------- */
const countEl = $('[data-count]');
const barEl = $('.loader__bar i');
const progress = { v: 0 };
function paintLoader() {
  countEl.textContent = Math.round(progress.v);
  barEl.style.transform = `scaleX(${progress.v / 100})`;
}
const loaderTween = gsap.to(progress, { v: 86, duration: 2.4, ease: 'power2.out', onUpdate: paintLoader });

// flipbook: hard cuts between real photos, words punching in on the beat
const reelImgs = $$('.loader__reel img');
const wordEl = $('[data-word]');
const WORDS = ['Pour.', 'Sip.', 'Bite.', 'Chai?', 'Coffee?', 'Ice cream?', 'Crunch.', 'Zero waste.', 'Repeat.'];
let reelI = 0, wordI = 0, beat = 0, reelTimer = 0, reelRunning = true;
function cut() {
  if (!reelRunning) return;
  reelImgs[reelI].classList.remove('is-on');
  reelI = (reelI + 1) % reelImgs.length;
  const img = reelImgs[reelI];
  img.style.transform = `scale(1.12) rotate(${(Math.random() * 6 - 3).toFixed(2)}deg)`;
  img.classList.add('is-on');
  requestAnimationFrame(() => { img.style.transform = ''; });
  if (beat++ % 2 === 0) {
    wordEl.textContent = WORDS[wordI++ % WORDS.length];
    gsap.fromTo(wordEl, { scale: 1.25, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.22, ease: 'power3.out' });
  }
  // speed up as it goes: 190ms → 95ms
  reelTimer = setTimeout(cut, Math.max(95, 190 - beat * 7));
}
reelTimer = setTimeout(cut, 220);

const pageLoaded = new Promise(r => (document.readyState === 'complete' ? r() : window.addEventListener('load', r, { once: true })));
const cupReady = createCup($('#cup3d')).then(c => { cup = c; }).catch(err => {
  console.warn('3D cup unavailable, carrying on without it.', err);
  document.documentElement.classList.add('no-webgl');
  $('#cup3d').style.display = 'none';
});
const minTime = new Promise(r => setTimeout(r, 2600));

Promise.all([pageLoaded, cupReady, minTime]).then(() => {
  loaderTween.kill();
  gsap.to(progress, {
    v: 100, duration: 0.5, ease: 'power1.inOut', onUpdate: paintLoader, onComplete: () => {
      // land on the chai shot, say the line, then blow the frame up and wipe away
      reelRunning = false; clearTimeout(reelTimer);
      reelImgs.forEach((im, i) => im.classList.toggle('is-on', i === 0));
      wordEl.textContent = 'Eat your drink.';
      const tl = gsap.timeline();
      tl.fromTo(wordEl, { scale: 1.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'power3.out' })
        .to('.loader__foot, .loader__brand, .loader__tag', { opacity: 0, duration: 0.3 }, '+=0.35')
        .to('.loader__reel', { width: '100vw', height: '100vh', borderRadius: 0, duration: 0.8, ease: 'expo.inOut' }, '<')
        .to(wordEl, { yPercent: -60, opacity: 0, duration: 0.5, ease: 'power2.in' }, '-=0.45')
        .to('.loader', { clipPath: 'inset(0 0 100% 0)', duration: 1.0, ease: 'expo.inOut' }, '-=0.1')
        .add(() => {
          document.body.classList.remove('is-loading');
          lenis && lenis.start();
          ScrollTrigger.refresh();
        }, '-=0.6')
        .from('.hero__title .line > span', { yPercent: 115, rotate: 4, duration: 1.3, ease: 'expo.out', stagger: 0.12 }, '-=0.55')
        .from('.hero__eyebrow, .hero__lede, .hero__ctas', { y: 24, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08 }, '-=1.0')
        .from('.hero__facts li', { y: 20, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.07 }, '-=0.8')
        .from('.hero__note', { opacity: 0, rotate: -16, scale: 0.8, duration: 1, ease: 'back.out(2)' }, '-=0.6')
        .from('.nav', { opacity: 0, duration: 0.8, ease: 'power2.out', clearProps: 'opacity,transform' }, '<')
        .fromTo('.dock', { yPercent: 160 }, { yPercent: 0, duration: 1, ease: 'back.out(1.6)', clearProps: 'transform' }, '<')
        .fromTo('.hero__mascot', { yPercent: 110 }, { yPercent: 0, duration: 1.1, ease: 'back.out(1.8)' }, '-=0.5')
        .fromTo('.hero__sticker', { scale: 0, rotate: -90 }, { scale: 1, rotate: 0, duration: 1, ease: 'back.out(2)' }, '<');
      if (cup) tl.to(cup.state, { intro: 1, duration: 1.8, ease: 'power3.out' }, 1.0);
      // draw the little arrow
      const arrowPaths = $$('.hero__arrow path');
      arrowPaths.forEach(p => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
      tl.to(arrowPaths, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut', stagger: 0.25 }, '-=0.3');
      tl.add(() => $('.loader').remove());
    },
  });
});

$('[data-year]').textContent = new Date().getFullYear();
ScrollTrigger.config({ ignoreMobileResize: true });
