<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { waveform, voiceState, ambience } from './stores';

	let canvas: HTMLCanvasElement;
	let renderer: THREE.WebGLRenderer;
	let scene: THREE.Scene;
	let camera: THREE.OrthographicCamera;
	let line: THREE.Line;
	let raf: number;

	const POINTS = 128;

	onMount(() => {
		renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
		renderer.setPixelRatio(devicePixelRatio);
		renderer.setClearColor(0x000000, 0);

		scene = new THREE.Scene();
		camera = new THREE.OrthographicCamera(-1, 1, 0.25, -0.25, 0, 1);

		const geo = new THREE.BufferGeometry();
		const positions = new Float32Array(POINTS * 3);
		geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

		const mat = new THREE.LineBasicMaterial({
			color: 0x8ab4d4,
			transparent: true,
			opacity: 0.7,
			linewidth: 1
		});
		line = new THREE.Line(geo, mat);
		scene.add(line);

		resize();
		window.addEventListener('resize', resize);
		tick();
	});

	onDestroy(() => {
		cancelAnimationFrame(raf);
		window.removeEventListener('resize', resize);
		renderer?.dispose();
	});

	function resize() {
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		renderer.setSize(w, h, false);
	}

	let t = 0;
	function tick() {
		raf = requestAnimationFrame(tick);
		t += 0.012;

		const amp = $ambience;
		if (amp < 0.01) { renderer.render(scene, camera); return; }

		const data = $waveform;
		const pos = (line.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
		const state = $voiceState;

		for (let i = 0; i < POINTS; i++) {
			const x = (i / (POINTS - 1)) * 2 - 1;
			let y = 0;

			if (state === 'listening' && data.length > 0) {
				const idx = Math.floor((i / POINTS) * data.length);
				y = data[idx] * 0.18 * amp;
			} else {
				// idle breath — slow sine with faint harmonics
				y = (
					Math.sin(x * Math.PI * 1.2 + t) * 0.04 +
					Math.sin(x * Math.PI * 2.8 - t * 0.7) * 0.015
				) * amp;
			}

			pos[i * 3]     = x;
			pos[i * 3 + 1] = y;
			pos[i * 3 + 2] = 0;
		}

		(line.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

		const mat = line.material as THREE.LineBasicMaterial;
		mat.opacity = state === 'listening' ? 0.9 * amp : 0.5 * amp;

		renderer.render(scene, camera);
	}
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
canvas {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	pointer-events: none;
}
</style>
