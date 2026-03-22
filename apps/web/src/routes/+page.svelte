<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';

  let canvas: HTMLCanvasElement;
  let showInstall = $state(false);

  // Detect platform for install instructions
  const platform = (() => {
    if (typeof navigator === 'undefined') return 'desktop';
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
    if (/android/i.test(ua)) return 'android';
    return 'desktop';
  })();

  // ── Deterministic hash ──────────────────────────────────────────────────────
  function h(seed: number, salt: number): number {
    let v = (seed ^ (salt * 0x9e3779b9)) >>> 0;
    v = Math.imul(v ^ (v >>> 16), 0x85ebca6b) >>> 0;
    v = Math.imul(v ^ (v >>> 13), 0xc2b2ae35) >>> 0;
    return ((v ^ (v >>> 16)) >>> 0) / 0xffffffff;
  }

  // ── Nebula palette ──────────────────────────────────────────────────────────
  // Helix Nebula: teal iris · gold dust ring · pink gas · amber tendrils · white core
  const HUES = {
    core:  185,   // near-white cyan
    teal:  172,   // inner iris
    gold:   38,   // dust ring
    pink:  295,   // gas wisps
    amber:  22,   // outer tendrils
  } as const;

  // Zone definitions — each star is assigned a radial zone at seed time.
  // r values are in world units (1 = half-screen height).
  const ZONES = [
    { maxP: 0.05, rMin: 0.00, rMax: 0.06, hue: HUES.core  },
    { maxP: 0.17, rMin: 0.04, rMax: 0.20, hue: HUES.teal  },
    { maxP: 0.44, rMin: 0.14, rMax: 0.44, hue: HUES.gold  },
    { maxP: 0.74, rMin: 0.30, rMax: 0.75, hue: HUES.pink  },
    { maxP: 1.00, rMin: 0.60, rMax: 1.70, hue: HUES.amber },
  ];

  // ── Sigil texture (nebula palette) ──────────────────────────────────────────
  function makeSigilTexture(seed: number, forceHue?: number): THREE.CanvasTexture {
    const size = 192;
    const cvs  = document.createElement('canvas');
    cvs.width  = cvs.height = size;
    const ctx  = cvs.getContext('2d')!;
    const cx   = size / 2, cy = size / 2;
    const maxR = size * 0.44;

    const nArms = 5 + Math.floor(h(seed, 0) * 4);
    const hue   = forceHue ?? Object.values(HUES)[Math.floor(h(seed, 99) * 5)];
    const lit   = 55 + Math.floor(h(seed, 98) * 25);
    const a0    = 0.70 + h(seed, 97) * 0.30;

    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    grd.addColorStop(0,    `hsla(${hue},65%,${lit}%,${a0})`);
    grd.addColorStop(0.30, `hsla(${hue},60%,${lit}%,${(a0 * 0.8).toFixed(2)})`);
    grd.addColorStop(0.70, `hsla(${hue},55%,${lit}%,0.2)`);
    grd.addColorStop(1,    `hsla(${hue},50%,${lit}%,0)`);

    const pts: [number, number][] = [];
    for (let i = 0; i < nArms; i++) {
      const outer = (i * 2 * Math.PI) / nArms - Math.PI / 2;
      const inner = outer + Math.PI / nArms;
      const oR    = maxR * (0.55 + h(seed, i * 4 + 1) * 0.45);
      pts.push([cx + oR * Math.cos(outer), cy + oR * Math.sin(outer)]);
      const iR    = maxR * (0.12 + h(seed, i * 4 + 2) * 0.22);
      const aShift = (h(seed, i * 4 + 3) - 0.5) * 0.55;
      pts.push([cx + iR * Math.cos(inner + aShift), cy + iR * Math.sin(inner + aShift)]);
    }
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = grd;
    ctx.fill();

    if (h(seed, 200) > 0.35) {
      ctx.fillStyle = `hsla(${hue},70%,${Math.min(lit + 15, 95)}%,0.6)`;
      for (let i = 0; i < nArms; i++) {
        const [px, py] = pts[i * 2];
        ctx.beginPath();
        ctx.arc(px, py, 1.5 + h(seed, i + 300) * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (h(seed, 400) > 0.55) {
      const sHue  = Object.values(HUES)[Math.floor(h(seed, 401) * 5)];
      const sAngle = h(seed, 402) * Math.PI;
      const sLen   = maxR * (0.5 + h(seed, 403) * 0.5);
      ctx.strokeStyle = `hsla(${sHue},60%,${lit + 10}%,0.4)`;
      ctx.lineWidth   = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx + sLen * Math.cos(sAngle), cy + sLen * Math.sin(sAngle));
      ctx.lineTo(cx - sLen * Math.cos(sAngle), cy - sLen * Math.sin(sAngle));
      ctx.stroke();
    }
    return new THREE.CanvasTexture(cvs);
  }

  // ── Star field ──────────────────────────────────────────────────────────────
  interface Star {
    sprite: THREE.Sprite;
    rotRate: number;
    opacity: number;
    size: number;
    twinkleHz: number;
    twinkleAmp: number;
    twinkleOff: number;
  }

  function makeStar(seed: number): Star {
    const p    = h(seed, 600);
    const zone = ZONES.find(z => p < z.maxP) ?? ZONES[ZONES.length - 1];
    const r    = zone.rMin + h(seed, 601) * (zone.rMax - zone.rMin);
    const theta = h(seed, 602) * Math.PI * 2;
    const zPos  = (h(seed, 603) - 0.5) * 4;

    const opacity = 0.30 + h(seed, 500) * 0.50;
    const size    = 0.022 + h(seed, 501) * 0.060;
    const mat = new THREE.SpriteMaterial({
      map: makeSigilTexture(seed, zone.hue),
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      rotation: h(seed, 502) * Math.PI * 2,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(r * Math.cos(theta), r * Math.sin(theta), zPos);
    sprite.scale.setScalar(size);

    return {
      sprite,
      rotRate:    (0.001 + h(seed, 506) * 0.004) * (h(seed, 507) > 0.5 ? 1 : -1),
      opacity,
      size,
      twinkleHz:  0.04 + h(seed, 508) * 0.12,
      twinkleAmp: 0.04 + h(seed, 509) * 0.08,
      twinkleOff: h(seed, 510) * Math.PI * 2,
    };
  }

  // ── Nebula glow layers ──────────────────────────────────────────────────────
  // Six concentric radial-gradient sprites behind the stars.
  // baseScale is a fraction of screenFill (2 * max(1, aspect)).
  // AdditiveBlending: glow stacks toward white in denser regions.
  interface GlowLayer {
    sprite:       THREE.Sprite;
    baseScale:    number;   // fraction of screenFill
    computedScale: number;  // actual world-unit scale (updated on resize)
  }

  type GlowStop = { t: number; h: number; s: number; l: number; a: number };

  function makeGlowTex(stops: GlowStop[]): THREE.CanvasTexture {
    const sz  = 512;
    const cv  = document.createElement('canvas');
    cv.width  = cv.height = sz;
    const ctx = cv.getContext('2d')!;
    const r   = sz / 2;
    const grd = ctx.createRadialGradient(r, r, 0, r, r, r);
    stops.forEach(({ t, h: hue, s, l, a }) => grd.addColorStop(t, `hsla(${hue},${s}%,${l}%,${a})`));
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, sz, sz);
    return new THREE.CanvasTexture(cv);
  }

  onMount(() => {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(devicePixelRatio);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    let aspect = canvas.clientWidth / canvas.clientHeight;
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

    // Orthographic camera — world unit = half-screen height, no portrait distortion
    const camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 100);
    camera.position.z = 5;

    // ── Build glow layers ──────────────────────────────────────────────────────
    const glowLayers: GlowLayer[] = [];

    function addGlow(stops: GlowStop[], baseScale: number, opacity: number): GlowLayer {
      const mat = new THREE.SpriteMaterial({
        map: makeGlowTex(stops),
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.z = -2;
      scene.add(sprite);
      const layer: GlowLayer = { sprite, baseScale, computedScale: 0 };
      glowLayers.push(layer);
      return layer;
    }

    // Outer amber tendrils
    addGlow([
      { t: 0.00, h: HUES.amber, s:  0, l:  0, a: 0.00 },
      { t: 0.25, h: HUES.amber, s: 65, l: 30, a: 0.30 },
      { t: 0.60, h: HUES.amber, s: 55, l: 20, a: 0.12 },
      { t: 1.00, h: HUES.amber, s: 40, l: 10, a: 0.00 },
    ], 1.50, 0.9);

    // Pink gas wisps
    addGlow([
      { t: 0.00, h: HUES.pink, s:  0, l:  0, a: 0.00 },
      { t: 0.20, h: HUES.pink, s: 45, l: 40, a: 0.35 },
      { t: 0.55, h: HUES.pink, s: 40, l: 30, a: 0.18 },
      { t: 1.00, h: HUES.pink, s: 30, l: 15, a: 0.00 },
    ], 1.10, 0.85);

    // Mid teal-to-pink transition
    addGlow([
      { t: 0.00, h: HUES.teal, s:  0, l:  0, a: 0.00 },
      { t: 0.18, h: HUES.teal, s: 65, l: 50, a: 0.28 },
      { t: 0.50, h: HUES.pink, s: 45, l: 45, a: 0.18 },
      { t: 1.00, h: HUES.pink, s: 30, l: 20, a: 0.00 },
    ], 0.80, 0.80);

    // Gold dust ring — dark center, bright ring, fade out
    addGlow([
      { t: 0.00, h: HUES.gold, s:  0, l:  0, a: 0.00 },
      { t: 0.14, h: HUES.gold, s:  0, l:  0, a: 0.00 },  // dark hole
      { t: 0.38, h: HUES.gold, s: 80, l: 60, a: 0.55 },  // gold ring peak
      { t: 0.58, h: HUES.gold, s: 70, l: 45, a: 0.20 },
      { t: 1.00, h: HUES.gold, s: 50, l: 20, a: 0.00 },
    ], 0.55, 0.80);

    // Inner teal iris
    addGlow([
      { t: 0.00, h: HUES.teal, s: 70, l: 65, a: 0.55 },
      { t: 0.40, h: HUES.teal, s: 65, l: 55, a: 0.35 },
      { t: 0.75, h: HUES.teal, s: 55, l: 35, a: 0.08 },
      { t: 1.00, h: HUES.teal, s:  0, l:  0, a: 0.00 },
    ], 0.28, 0.90);

    // Bright central core
    addGlow([
      { t: 0.00, h: HUES.core, s: 30, l: 95, a: 0.90 },
      { t: 0.30, h: HUES.teal, s: 60, l: 70, a: 0.55 },
      { t: 0.70, h: HUES.teal, s: 55, l: 45, a: 0.10 },
      { t: 1.00, h: HUES.teal, s:  0, l:  0, a: 0.00 },
    ], 0.07, 0.95);

    // ── Compute glow scales from current aspect ──────────────────────────────
    function updateGlowScales() {
      // screenFill: world-unit scale that covers the full screen in both axes
      const fill = 2 * Math.max(1, aspect);
      glowLayers.forEach(layer => {
        layer.computedScale = layer.baseScale * fill;
        layer.sprite.scale.setScalar(layer.computedScale);
      });
    }
    updateGlowScales();

    // ── Stars ─────────────────────────────────────────────────────────────────
    const groupA = new THREE.Group();
    const groupB = new THREE.Group();
    scene.add(groupA, groupB);

    const stars: Star[] = [];
    for (let i = 0; i < 220; i++) {
      const star = makeStar(i + 1);
      (i % 3 === 0 ? groupB : groupA).add(star.sprite);
      stars.push(star);
    }

    // ── Resize ────────────────────────────────────────────────────────────────
    const onResize = () => {
      const nw = canvas.clientWidth, nh = canvas.clientHeight;
      aspect = nw / nh;
      camera.left  = -aspect;
      camera.right =  aspect;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh, false);
      updateGlowScales();
    };
    window.addEventListener('resize', onResize);

    // ── Animation loop ────────────────────────────────────────────────────────
    let raf: number;
    let t = 0;
    function tick() {
      raf = requestAnimationFrame(tick);
      t += 0.016;

      // Slow dual-group rotation (parallax)
      groupA.rotation.y += 0.00025;
      groupA.rotation.x += 0.00008;
      groupB.rotation.y -= 0.00015;
      groupB.rotation.x += 0.00012;

      // Nebula breath — whole nebula pulses ~once per 16s (2% scale, very subtle)
      const breath = 1 + Math.sin(t * 0.04 * Math.PI * 2) * 0.02;
      glowLayers.forEach(layer => {
        layer.sprite.scale.setScalar(layer.computedScale * breath);
      });

      // Star twinkle + sigil rotation
      stars.forEach(({ sprite, rotRate, opacity, size, twinkleHz, twinkleAmp, twinkleOff }) => {
        const mat   = sprite.material as THREE.SpriteMaterial;
        mat.rotation += rotRate;
        const pulse  = Math.sin(t * twinkleHz * Math.PI * 2 + twinkleOff);
        mat.opacity  = Math.max(0.05, opacity + pulse * twinkleAmp);
        sprite.scale.setScalar(size * (1 + pulse * twinkleAmp * 0.15));
      });

      renderer.render(scene, camera);
    }
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  });
</script>

<div class="hero">
  <canvas bind:this={canvas} aria-hidden="true"></canvas>
  <a href="/enquire" class="enter"><span class="enter-label">enter</span></a>
</div>

<section class="about">
  <div class="prose">
    <h2>A space, not an app</h2>
    <p>
      Ouracle is a ritual space for reflection. Clea — named for the priestess
      of the Oracle at Delphi — is not here to tell you what you want to hear.
      She listens for the meaning beneath what you say, reflects what you already
      know, and responds with what you need to hear and what you need to do next.
      Nothing scripted. No two sessions alike.
    </p>
  </div>
  <div class="prose">
    <h2>A question. A rite. Return.</h2>
    <p>
      Think of it as a daily game: bring a question, leave with a rite to enact.
      Speak or type — Clea prefers your voice. Free to begin, no account needed.
      <button class="install-link" onclick={() => showInstall = true}>Add to your home screen</button>
      and treat it like a practice.
    </p>
  </div>
  <div class="prose">
    <h2>From here to the next octave</h2>
    <p>
      For when advice isn't enough. For when you already know the answer but haven't
      said it aloud yet. Clea draws on healing modalities and wisdom traditions
      worldwide — including dozens of divination decks by <a href="https://howstrangeitistobeanythingatall.com" target="_blank" rel="noopener">Alan Botts</a>. She guides you
      one rite at a time, and keeps an encrypted record of the journey in your Totem.
    </p>
  </div>
  <div class="prose">
    <h2>Drawn from everywhere. Bound to nothing.</h2>
    <p>
      Ouracle draws from wisdom traditions across cultures and throughout human
      history. It is not a faith, not therapy, not a diagnosis. It's a safe ritual
      frame that meets you exactly where you are — and asks only: what is the next
      right thing?
    </p>
  </div>
</section>

{#if showInstall}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="install-backdrop" role="dialog" aria-modal="true" onclick={() => showInstall = false} onkeydown={(e) => e.key === 'Escape' && (showInstall = false)}>
    <div class="install-modal" onclick={(e) => e.stopPropagation()}>
      <button class="install-close" onclick={() => showInstall = false} aria-label="Close">✕</button>
      <h3>Add Ouracle to your home screen</h3>

      {#if platform === 'ios'}
        <ol>
          <li>Tap the <strong>Share</strong> button <span class="key">⬆︎</span> at the bottom of Safari</li>
          <li>Tap <strong>Add to Home Screen</strong> in the list</li>
          <li>Tap <strong>Add</strong> to confirm</li>
        </ol>
        <p class="install-note">Safari only — Chrome and Firefox on iOS cannot install PWAs.</p>
      {:else if platform === 'android'}
        <ol>
          <li>Tap the <strong>menu</strong> <span class="key">⋮</span> in Chrome</li>
          <li>Tap <strong>Add to Home screen</strong> or <strong>Install app</strong></li>
          <li>Tap <strong>Add</strong> to confirm</li>
        </ol>
      {:else}
        <ol>
          <li>Look for the <strong>install icon</strong> <span class="key">⊕</span> in the address bar</li>
          <li>Or open the browser menu and select <strong>Install Ouracle</strong></li>
          <li>Click <strong>Install</strong> to confirm</li>
        </ol>
        <p class="install-note">Supported in Chrome, Edge, and Arc. Firefox does not support PWA install.</p>
      {/if}
    </div>
  </div>
{/if}

<style>
.hero {
  position: relative;
  height: calc(100dvh - 57px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.wordmark {
  font-family: var(--font-display);
  font-size: clamp(3rem, 10vw, 5rem);
  font-weight: 600;
  letter-spacing: 0.3em;
  color: var(--accent);
  line-height: 1;
  /* Soft glow ties the wordmark into the nebula */
  text-shadow: 0 0 48px color-mix(in srgb, var(--accent) 55%, transparent);
}
.tagline {
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-style: italic;
  color: var(--text);
  letter-spacing: 0.1em;
}
.body {
  font-size: 0.95rem;
  line-height: var(--leading);
  color: var(--muted);
  max-width: 420px;
}
.enter {
  display: block;
  border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  border-radius: 100%;
  color: var(--accent);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 12vh;
  letter-spacing: 0.2em;
  padding: 0em 2.25rem 0.25em;
  text-decoration: none;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  width: content-fit;
  height: content-fit;
  line-height: 4;
  transition: color 300ms ease-in-out, background 300ms ease-in-out, backdrop-filter 300ms ease-in-out;
  animation: enter-pulse 2.5s ease-in-out infinite;
  mix-blend-mode: color-burn;
  @media (prefers-color-scheme: light) {
      mix-blend-mode: color-dodge;
  }
}
.enter:hover {
  animation: none;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--bg);
  border-color: var(--accent);
}
@keyframes enter-pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 20%, transparent),
                inset 0 0 12px color-mix(in srgb, var(--accent) 8%, transparent);
    border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  }
  50% {
    transform: scale(1.04);
    box-shadow: 0 0 48px color-mix(in srgb, var(--accent) 55%, transparent),
                inset 0 0 24px color-mix(in srgb, var(--accent) 18%, transparent);
    border-color: var(--accent);
  }
}
.about {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-md);
  max-width: var(--max-wide);
  margin: 0 auto;
  padding: var(--space-xl) var(--space-md);
}
@media (max-width: 960px)  { .about { grid-template-columns: 1fr 1fr; } }
@media (max-width: 540px)  { .about { grid-template-columns: 1fr; } }
.install-link {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  padding: 0;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 3px;
}
.install-link:hover { text-decoration-style: solid; }

.install-backdrop {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--bg) 60%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.install-modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) * 3);
  max-width: 380px;
  width: 100%;
  padding: 2rem;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.install-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.25rem 0.4rem;
  line-height: 1;
  transition: color 0.15s;
}
.install-close:hover { color: var(--text); }

.install-modal h3 {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 400;
  letter-spacing: 0.06em;
  color: var(--text);
}

.install-modal ol {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding-left: 1.4rem;
}

.install-modal li {
  font-size: 0.88rem;
  line-height: 1.5;
  color: var(--muted);
}

.install-modal li strong { color: var(--text); }

.key {
  display: inline-block;
  background: var(--border);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 0.75em;
  padding: 0.1em 0.4em;
  color: var(--text);
}

.install-note {
  font-size: 0.72rem;
  color: var(--muted);
  opacity: 0.7;
  font-style: italic;
  margin: 0;
}

.prose h2 {
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 400;
  margin-bottom: var(--space-sm);
  color: var(--text);
}
.prose p { font-size: 0.95rem; line-height: 1.8; color: var(--muted); }
</style>
