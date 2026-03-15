<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';

  let canvas: HTMLCanvasElement;

  function makeStarTexture(nPoints: number): THREE.CanvasTexture {
    const size = 64;
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = size;
    const ctx = cvs.getContext('2d')!;
    const cx = size / 2, cy = size / 2;
    const outer = size * 0.46, inner = outer * 0.38;

    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, outer);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.2, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.6, 'rgba(255,255,255,0.2)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.beginPath();
    for (let i = 0; i < nPoints * 2; i++) {
      const angle = (i * Math.PI) / nPoints - Math.PI / 2;
      const r = i % 2 === 0 ? outer : inner;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = grd;
    ctx.fill();

    return new THREE.CanvasTexture(cvs);
  }

  function makeStarGroup(nPoints: number, count: number, color: number, size: number) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * 6;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      map: makeStarTexture(nPoints),
      color,
      size,
      transparent: true,
      opacity: 0.65,
      alphaTest: 0.01,
      depthWrite: false,
      sizeAttenuation: true,
    });
    return new THREE.Points(geo, mat);
  }

  onMount(() => {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(devicePixelRatio);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
    camera.position.z = 3;

    // Star groups: [points, count, color, size]
    const groups = [
      makeStarGroup(5, 80, 0x8ab4d4, 0.07),  // 5-pt, steel blue
      makeStarGroup(4, 50, 0xb4a8e8, 0.06),  // 4-pt, lavender
      makeStarGroup(6, 40, 0x6abfbf, 0.08),  // 6-pt, teal
      makeStarGroup(3, 20, 0x9ecde8, 0.10),  // 3-pt, light blue, larger
      makeStarGroup(8, 15, 0xd4b8f0, 0.05),  // 8-pt, soft violet, small
    ];
    groups.forEach(g => scene.add(g));

    const onResize = () => {
      const nw = canvas.clientWidth, nh = canvas.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh, false);
    };
    window.addEventListener('resize', onResize);

    let raf: number;
    function tick() {
      raf = requestAnimationFrame(tick);
      groups.forEach((g, i) => {
        g.rotation.y += 0.0003 + i * 0.00004;
        g.rotation.x += 0.0001 + i * 0.00002;
        g.rotation.z += 0.00015 * (i % 2 === 0 ? 1 : -1);
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
    <h1>Ouracle</h1>
    <p class="tagline">A palace of echoes and mirrors</p>
    <p class="body">
      This is a place to reflect. Our priestesses will be right with you. Please come in.
    </p>
    <a href="/chat" class="enter">enter</a>
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
h1 {
  font-family: var(--font-display);
  font-size: clamp(3rem, 10vw, 5rem);
  font-weight: 300;
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
  line-height: 1.7;
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
