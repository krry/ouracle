<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';

  let canvas: HTMLCanvasElement;

  // ── Deterministic hash ──────────────────────────────────────────────────────
  // Avalanche-quality 32-bit hash — seed × salt → float [0, 1)
  function h(seed: number, salt: number): number {
    let v = (seed ^ (salt * 0x9e3779b9)) >>> 0;
    v = Math.imul(v ^ (v >>> 16), 0x85ebca6b) >>> 0;
    v = Math.imul(v ^ (v >>> 13), 0xc2b2ae35) >>> 0;
    return ((v ^ (v >>> 16)) >>> 0) / 0xffffffff;
  }

  // ── Sigil texture ───────────────────────────────────────────────────────────
  // Generates a unique AOS-style radial glyph from an integer seed.
  // Each sigil has irregular arm lengths, perturbed valley angles,
  // optional circle caps, and a hue drawn from the three treasures.
  function makeSigilTexture(seed: number): THREE.CanvasTexture {
    const size = 192;
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = size;
    const ctx = cvs.getContext('2d')!;
    const cx = size / 2, cy = size / 2;
    const maxR = size * 0.44;

    // Derive arms (3..8) and hue from seed
    const nArms = 5 + Math.floor(h(seed, 0) * 4); // 5..8 — no sparse triangles/quads
    const hues = [217, 354, 80] as const;   // jing · shen · qi
    const hue = hues[Math.floor(h(seed, 99) * 3)];
    const lit = 55 + Math.floor(h(seed, 98) * 25);  // 55..80%
    const alpha0 = 0.75 + h(seed, 97) * 0.25;        // 0.75..1.0

    // Radial gradient for glow
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    grd.addColorStop(0,   `hsla(${hue},60%,${lit}%,${alpha0})`);
    grd.addColorStop(0.25,`hsla(${hue},60%,${lit}%,${(alpha0 * 0.85).toFixed(2)})`);
    grd.addColorStop(0.65,`hsla(${hue},55%,${lit}%,0.3)`);
    grd.addColorStop(1,   `hsla(${hue},50%,${lit}%,0)`);

    // Build star path — alternating outer (arm tip) and inner (valley) points
    const pts: [number, number][] = [];
    for (let i = 0; i < nArms; i++) {
      const baseOuter = (i * 2 * Math.PI) / nArms - Math.PI / 2;
      const baseInner = baseOuter + Math.PI / nArms;

      // Outer tip: varying length
      const outerR = maxR * (0.55 + h(seed, i * 4 + 1) * 0.45);
      pts.push([cx + outerR * Math.cos(baseOuter), cy + outerR * Math.sin(baseOuter)]);

      // Inner valley: perturbed angle + shorter, variable depth
      const innerR = maxR * (0.12 + h(seed, i * 4 + 2) * 0.22);
      const angleShift = (h(seed, i * 4 + 3) - 0.5) * 0.55;
      pts.push([cx + innerR * Math.cos(baseInner + angleShift), cy + innerR * Math.sin(baseInner + angleShift)]);
    }

    // Draw filled sigil path
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = grd;
    ctx.fill();

    // Optional: small circle caps at arm tips (AOS-style terminal marks)
    const capChance = h(seed, 200);
    if (capChance > 0.35) {
      ctx.fillStyle = `hsla(${hue},70%,${Math.min(lit + 15, 95)}%,0.6)`;
      for (let i = 0; i < nArms; i++) {
        const [px, py] = pts[i * 2];
        const capR = 1.5 + h(seed, i + 300) * 2.5;
        ctx.beginPath();
        ctx.arc(px, py, capR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Optional: cross-stroke through center (AOS signature element)
    if (h(seed, 400) > 0.55) {
      const strokeHue = hues[Math.floor(h(seed, 401) * 3)];
      const strokeAngle = h(seed, 402) * Math.PI;
      const strokeLen = maxR * (0.5 + h(seed, 403) * 0.5);
      ctx.strokeStyle = `hsla(${strokeHue},60%,${lit + 10}%,0.4)`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx + strokeLen * Math.cos(strokeAngle), cy + strokeLen * Math.sin(strokeAngle));
      ctx.lineTo(cx - strokeLen * Math.cos(strokeAngle), cy - strokeLen * Math.sin(strokeAngle));
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
    const tex = makeSigilTexture(seed);
    const opacity = 0.35 + h(seed, 500) * 0.45;
    const size    = 0.04 + h(seed, 501) * 0.12;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity,
      depthWrite: false,
      rotation: h(seed, 502) * Math.PI * 2,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(
      (h(seed, 503) - 0.5) * 7,
      (h(seed, 504) - 0.5) * 7,
      (h(seed, 505) - 0.5) * 7,
    );
    sprite.scale.setScalar(size);
    const rotRate   = (0.001 + h(seed, 506) * 0.004) * (h(seed, 507) > 0.5 ? 1 : -1);
    const twinkleHz = 0.04 + h(seed, 508) * 0.12;  // 0.04..0.16 Hz (~6–25s cycle)
    const twinkleAmp= 0.04 + h(seed, 509) * 0.08; // depth of pulse (gentle)
    const twinkleOff= h(seed, 510) * Math.PI * 2;  // phase offset
    return { sprite, rotRate, opacity, size, twinkleHz, twinkleAmp, twinkleOff };
  }

  onMount(() => {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(devicePixelRatio);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const w = canvas.clientWidth, h_px = canvas.clientHeight;
    renderer.setSize(w, h_px, false);
    const camera = new THREE.PerspectiveCamera(60, w / h_px, 0.1, 100);
    camera.position.z = 3;

    // Two slow-rotation groups for parallax feel
    const groupA = new THREE.Group();
    const groupB = new THREE.Group();
    scene.add(groupA, groupB);

    const TOTAL = 220;
    const stars: Star[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const star = makeStar(i + 1); // seed 0 reserved
      (i % 3 === 0 ? groupB : groupA).add(star.sprite);
      stars.push(star);
    }

    const onResize = () => {
      const nw = canvas.clientWidth, nh = canvas.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh, false);
    };
    window.addEventListener('resize', onResize);

    let raf: number;
    let t = 0;
    function tick() {
      raf = requestAnimationFrame(tick);
      t += 0.016; // ~60fps seconds accumulator
      groupA.rotation.y += 0.00025;
      groupA.rotation.x += 0.00008;
      groupB.rotation.y -= 0.00015;
      groupB.rotation.x += 0.00012;
      stars.forEach(({ sprite, rotRate, opacity, size, twinkleHz, twinkleAmp, twinkleOff }) => {
        const mat = sprite.material as THREE.SpriteMaterial;
        mat.rotation += rotRate;
        // Sinusoidal opacity twinkle — each sigil on its own phase/frequency
        const pulse = Math.sin(t * twinkleHz * Math.PI * 2 + twinkleOff);
        mat.opacity = Math.max(0.05, opacity + pulse * twinkleAmp);
        // Subtle scale breathe — 15% of twinkle amplitude
        const breathe = 1 + pulse * twinkleAmp * 0.15;
        sprite.scale.setScalar(size * breathe);
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
  <div class="content">
    <h1 class="wordmark">Ouracle</h1>
    <p class="tagline">Plot the next step</p>
    <p class="body">
      Our priestesses will be with you shortly.<br/>Please come in.
    </p>
    <a href="/enquire" class="enter">enter the temple</a>
  </div>
</div>

<section class="about">
  <div class="prose">
    <h2>What is Ouracle?</h2>
    <p>
      Ouracle works through a symbolic framework — reading your emotional
      and energetic state, meeting you where you are, and responding with care.
      Each session leaves a trace in your Totem: an encrypted record, yours alone.
    </p>
  </div>
  <div class="prose">
    <h2>Your Totem</h2>
    <p>
      Your Totem is your memory within Ouracle — encrypted, portable,
      irreplaceable. Keep it on your device, in the cloud, or both.
      When you arrive, it opens. When you leave, it closes.
    </p>
  </div>
</section>

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
.content {
  position: relative;
  text-align: center;
  max-width: var(--max-prose);
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
}
.wordmark {
  font-family: var(--font-display);
  font-size: clamp(3rem, 10vw, 5rem);
  font-weight: 600;
  letter-spacing: 0.3em;
  color: var(--accent);
  line-height: 1;
}
.tagline {
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-style: italic;
  color: var(--muted);
  letter-spacing: 0.1em;
}
.body {
  font-size: 0.95rem;
  line-height: var(--leading);
  color: var(--muted);
  max-width: 420px;
}
.enter {
  margin-top: var(--space-sm);
  border: 1px solid var(--accent);
  border-radius: var(--radius);
  color: var(--accent);
  font-family: var(--font-sans);
  font-size: 0.85rem;
  letter-spacing: 0.2em;
  padding: 0.6rem 2rem;
  text-decoration: none;
  transition: all 0.2s;
}
.enter:hover { background: var(--accent); color: var(--bg); }
.about {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
  max-width: var(--max-wide);
  margin: 0 auto;
  padding: var(--space-xl) var(--space-md);
}
@media (max-width: 640px) { .about { grid-template-columns: 1fr; } }
.prose h2 {
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 400;
  margin-bottom: var(--space-sm);
  color: var(--text);
}
.prose p { font-size: 0.95rem; line-height: 1.8; color: var(--muted); }
</style>
