<script lang="ts">
  let { opacity = 1 }: { opacity?: number } = $props();
</script>

<div class="nebula" style="opacity: {opacity}" aria-hidden="true"></div>

<style>
  /* ── Nebula — pure CSS shimmer replacement for WebGL cosmos ──────────────
     Two pseudo-element layers carrying Ouracle's hue vocabulary drift at
     prime-factor speeds; ::after also slow-cycles hue-rotate to produce
     iridescence without any JS, canvas, or GPU memory budget.
     ───────────────────────────────────────────────────────────────────── */

  .nebula {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    filter: saturate(0.82) brightness(0.92);
  }

  /* Layer 1 — core nebula arc (core/teal → pink → amber) */
  .nebula::before {
    content: '';
    position: absolute;
    inset: -16%;
    will-change: transform, opacity;
    background:
      radial-gradient(ellipse 78% 62% at 20% 35%, hsl(185 64% 42% / 0.44), transparent 74%),
      radial-gradient(ellipse 62% 72% at 78% 62%, hsl(295 48% 42% / 0.34), transparent 68%),
      radial-gradient(ellipse 88% 46% at 50% 92%, hsl(22 64% 36% / 0.28), transparent 68%);
    animation: nebula-a 32s ease-in-out infinite alternate;
  }

  /* Layer 2 — warm arc (gold → teal), drifts opposite + hue cycles */
  .nebula::after {
    content: '';
    position: absolute;
    inset: -18%;
    will-change: transform, filter, opacity;
    background:
      radial-gradient(ellipse 66% 74% at 80% 18%, hsl(38 74% 46% / 0.22), transparent 70%),
      radial-gradient(ellipse 58% 64% at 14% 74%, hsl(172 64% 38% / 0.36), transparent 66%);
    animation:
      nebula-b   41s ease-in-out infinite alternate-reverse,
      nebula-hue 58s linear      infinite;
    opacity: 0.86;
  }

  /* Light mode — visible pastels on near-white */
  @media (prefers-color-scheme: light) {
    .nebula::before {
      background:
        radial-gradient(ellipse 78% 62% at 20% 35%, hsl(185 54% 64% / 0.34), transparent 74%),
        radial-gradient(ellipse 62% 72% at 78% 62%, hsl(295 42% 68% / 0.28), transparent 68%),
        radial-gradient(ellipse 88% 46% at 50% 92%, hsl(22 54% 72% / 0.22), transparent 68%);
    }
    .nebula::after {
      background:
        radial-gradient(ellipse 66% 74% at 80% 18%, hsl(38  64% 70% / 0.18), transparent 70%),
        radial-gradient(ellipse 58% 64% at 14% 74%, hsl(172 54% 62% / 0.28), transparent 66%);
    }
  }

  @keyframes nebula-a {
    0%   { transform: translate3d(0%, 0%, 0) scale(1.08); }
    20%  { transform: translate3d(-2%, 1.2%, 0) scale(1.1); }
    40%  { transform: translate3d(1.2%, -2%, 0) scale(1.09); }
    60%  { transform: translate3d(-1.4%, 2.1%, 0) scale(1.11); }
    80%  { transform: translate3d(2%, -1.2%, 0) scale(1.09); }
    100% { transform: translate3d(-0.6%, 0.8%, 0) scale(1.08); }
  }

  @keyframes nebula-b {
    0%   { transform: translate3d(0%, 0%, 0) scale(1.12); }
    25%  { transform: translate3d(1.6%, -2.1%, 0) scale(1.1); }
    50%  { transform: translate3d(-2.1%, 1.2%, 0) scale(1.13); }
    75%  { transform: translate3d(1.2%, 1.8%, 0) scale(1.11); }
    100% { transform: translate3d(-1.8%, -1.2%, 0) scale(1.12); }
  }

  @keyframes nebula-hue {
    from { filter: hue-rotate(  0deg); }
    to   { filter: hue-rotate(360deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .nebula::before,
    .nebula::after { animation: none; }
  }
</style>
