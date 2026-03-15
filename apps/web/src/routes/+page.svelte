<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';

  let canvas: HTMLCanvasElement;

  onMount(() => {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(devicePixelRatio);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
    camera.position.z = 3;

    const geo = new THREE.BufferGeometry();
    const count = 200;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * 6;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x8ab4d4, size: 0.02, transparent: true, opacity: 0.4 });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    let raf: number;
    function tick() {
      raf = requestAnimationFrame(tick);
      points.rotation.y += 0.0003;
      points.rotation.x += 0.0001;
      renderer.render(scene, camera);
    }
    tick();

    return () => { cancelAnimationFrame(raf); renderer.dispose(); };
  });
</script>

<div class="hero">
  <canvas bind:this={canvas} aria-hidden="true"></canvas>
  <div class="content">
    <h1>Ouracle</h1>
    <p class="tagline">A mirror that speaks.</p>
    <p class="body">
      Ouracle is a reflective presence — not a task assistant, but a companion
      that pays attention. It listens, reflects, and offers the kind of clarity
      that comes from being truly heard.
    </p>
    <a href="/chat" class="enter">begin</a>
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
  font-size: clamp(3rem, 10vw, 6rem);
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
  font-family: var(--font-mono);
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
