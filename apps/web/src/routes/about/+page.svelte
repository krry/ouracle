<script lang="ts">
  import { controlPanelRouteById } from '$lib/ControlPanel.svelte';
</script>

<svelte:head>
  <title>About | Ouracle</title>
</svelte:head>

<div class="page">
  <header>
    <h1 class="wordmark">About</h1>
    <p class="sub">priestesses, rites, decks, and the ritual frame</p>
  </header>

  <section class="prose-section">
    <p>
      Clea was keeper of two mysteries in one body: the ecstatic wildness of Dionysus
      and the transformational weight of Isis. She exists in the record mostly by being
      addressed. She does not explain so much as witness, amplify, and call forth.
    </p>
    <p>
      Phemonoe stands nearer the threshold. She receives the first approach, keeps the
      lighter gate, and speaks before the seeker is fully known. Between them, the temple
      moves from question to rite.
    </p>
    <p>
      Ouracle is not a faith, not therapy, and not diagnosis. It is a ritual frame for
      reflective action. Decks, rites, and conversation all serve the same function:
      to help a seeker find the next right enactment.
    </p>
  </section>

  <section class="gratitudes">
    <h2>Gratitudes</h2>
    <p class="note">
      The ambient sound recordings used in the Ambience layer were contributed by artists
      on <a href="https://freesound.org" target="_blank" rel="noopener">Freesound.org</a>:
      <a href="https://freesound.org/people/cvltiv8r/" target="_blank" rel="noopener">cvltiv8r</a>,
      <a href="https://freesound.org/people/klankbeeld/" target="_blank" rel="noopener">klankbeeld</a>,
      <a href="https://freesound.org/people/newlocknew/" target="_blank" rel="noopener">newlocknew</a>,
      <a href="https://freesound.org/people/nightcustard/" target="_blank" rel="noopener">nightcustard</a>,
      and <a href="https://freesound.org/people/soapboxrocket/" target="_blank" rel="noopener">soapboxrocket</a>.
      Clea's voice is synthesized via <a href="https://fish.audio" target="_blank" rel="noopener">Fish Audio</a>.
    </p>
  </section>

  <section class="install">
    <h2>In your browser</h2>
    <a href={controlPanelRouteById.draw.href} class="cta">enter the temple</a>

    <h2>For developers</h2>
    <p class="note">
      Want the shell, the local stack, or the open infrastructure?
      <a href={controlPanelRouteById.devs.href}>visit devs →</a>
    </p>
  </section>
</div>

<style>
.page {
  max-width: var(--max-prose);
  margin: 0 auto;
  padding: var(--space-xl) var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

header { text-align: center; }

.wordmark {
  font-family: var(--font-display);
  font-size: 3rem;
  font-weight: 600;
  letter-spacing: 0.22em;
  color: var(--accent);
}

.sub {
  font-family: var(--font-display);
  font-style: italic;
  color: var(--muted);
  margin-top: 0.5rem;
  text-align: center;
}

.prose-section p {
  font-size: 1rem;
  line-height: var(--leading);
  color: var(--text);
  text-align: left;
  margin-bottom: 1rem;
}

.install {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

h2 {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.15em;
  color: var(--muted);
  text-transform: uppercase;
  margin-top: var(--space-sm);
}

.note { font-size: 0.75rem; color: var(--muted); }
.note a { color: var(--accent); }

.cta {
  align-self: flex-start;
  border: 1px solid var(--accent);
  border-radius: var(--radius);
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  padding: 0.5rem 1.2rem;
  text-decoration: none;
  text-transform: lowercase;
}

.cta:hover { background: var(--accent); color: var(--bg); }
</style>
