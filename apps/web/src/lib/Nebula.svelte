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
  }

  /* Layer 1 — core nebula arc (core/teal → pink → amber) */
  .nebula::before {
    content: '';
    position: absolute;
    inset: 0;
    will-change: transform;
    background:
      radial-gradient(ellipse 70% 55% at 20% 35%, hsl(185 70% 45% / 0.80), transparent 70%),
      radial-gradient(ellipse 55% 65% at 78% 62%, hsl(295 55% 45% / 0.70), transparent 65%),
      radial-gradient(ellipse 80% 42% at 50% 92%, hsl(22  75% 38% / 0.65), transparent 65%);
    animation: nebula-a 32s ease-in-out infinite alternate;
  }

  /* Layer 2 — warm arc (gold → teal), drifts opposite + hue cycles */
  .nebula::after {
    content: '';
    position: absolute;
    inset: 0;
    will-change: transform, filter;
    background:
      radial-gradient(ellipse 60% 68% at 80% 18%, hsl(38  85% 48% / 0.65), transparent 65%),
      radial-gradient(ellipse 52% 58% at 14% 74%, hsl(172 70% 42% / 0.72), transparent 60%);
    animation:
      nebula-b   41s ease-in-out infinite alternate-reverse,
      nebula-hue 58s linear      infinite;
  }

  /* Light mode — visible pastels on near-white */
  @media (prefers-color-scheme: light) {
    .nebula::before {
      background:
        radial-gradient(ellipse 70% 55% at 20% 35%, hsl(185 60% 62% / 0.65), transparent 70%),
        radial-gradient(ellipse 55% 65% at 78% 62%, hsl(295 48% 66% / 0.58), transparent 65%),
        radial-gradient(ellipse 80% 42% at 50% 92%, hsl(22  65% 68% / 0.52), transparent 65%);
    }
    .nebula::after {
      background:
        radial-gradient(ellipse 60% 68% at 80% 18%, hsl(38  72% 66% / 0.55), transparent 65%),
        radial-gradient(ellipse 52% 58% at 14% 74%, hsl(172 62% 60% / 0.62), transparent 60%);
    }
  }

  @keyframes nebula-a {
    0%   { transform: translate( 0.0%,  0.0%); }
    20%  { transform: translate(-2.5%,  1.5%); }
    40%  { transform: translate( 1.5%, -2.5%); }
    60%  { transform: translate(-1.5%,  2.5%); }
    80%  { transform: translate( 2.5%, -1.5%); }
    100% { transform: translate(-0.5%,  1.0%); }
  }

  @keyframes nebula-b {
    0%   { transform: translate( 0.0%,  0.0%); }
    25%  { transform: translate( 2.0%, -2.5%); }
    50%  { transform: translate(-2.5%,  1.5%); }
    75%  { transform: translate( 1.5%,  2.0%); }
    100% { transform: translate(-2.0%, -1.5%); }
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
