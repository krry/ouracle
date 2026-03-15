<script lang="ts">
	import { signup, signin } from './api';
	import { creds } from './stores';

	let mode: 'sign-in' | 'sign-up' = 'sign-in';
	let name = '';
	let password = '';
	let error = '';
	let busy = false;

	async function submit() {
		error = '';
		busy = true;
		try {
			const res = mode === 'sign-up'
				? await signup(name, password)
				: await signin(name, password);
			creds.login(res);
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'something went wrong';
		} finally {
			busy = false;
		}
	}
</script>

<main>
	<header>
		<h1>Ouracle</h1>
		<p class="sub">speak. listen. know.</p>
	</header>

	<form on:submit|preventDefault={submit}>
		<label>
			<span>name</span>
			<input bind:value={name} type="text" autocomplete="username" required />
		</label>
		<label>
			<span>password</span>
			<input bind:value={password} type="password" autocomplete={mode === 'sign-up' ? 'new-password' : 'current-password'} required />
		</label>

		{#if error}<p class="error">{error}</p>{/if}

		<button type="submit" disabled={busy}>
			{busy ? '…' : mode === 'sign-in' ? 'enter' : 'begin'}
		</button>
	</form>

	<button class="toggle" on:click={() => mode = mode === 'sign-in' ? 'sign-up' : 'sign-in'}>
		{mode === 'sign-in' ? 'new seeker' : 'returning seeker'}
	</button>
</main>

<style>
main {
	height: 100dvh;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 2rem;
	padding: 2rem;
}

header { text-align: center; }

h1 {
	font-size: 2rem;
	letter-spacing: 0.2em;
	color: var(--accent);
}

.sub {
	color: var(--muted);
	font-size: 0.8rem;
	letter-spacing: 0.15em;
	margin-top: 0.4rem;
}

form {
	display: flex;
	flex-direction: column;
	gap: 1rem;
	width: 100%;
	max-width: 320px;
}

label {
	display: flex;
	flex-direction: column;
	gap: 0.3rem;
	font-size: 0.75rem;
	color: var(--muted);
	letter-spacing: 0.1em;
}

input {
	background: var(--surface);
	border: 1px solid var(--border);
	border-radius: var(--radius);
	color: var(--text);
	font-family: var(--font-mono);
	font-size: 1rem;
	padding: 0.6rem 0.8rem;
	outline: none;
	transition: border-color 0.15s;
}

input:focus { border-color: var(--accent); }

button[type="submit"] {
	background: var(--accent);
	border: none;
	border-radius: var(--radius);
	color: var(--bg);
	cursor: pointer;
	font-family: var(--font-mono);
	font-size: 0.9rem;
	letter-spacing: 0.1em;
	padding: 0.7rem;
	transition: opacity 0.15s;
}

button[type="submit"]:disabled { opacity: 0.4; cursor: default; }

.error {
	color: hsl(0, 60%, 65%);
	font-size: 0.8rem;
}

.toggle {
	background: none;
	border: none;
	color: var(--muted);
	cursor: pointer;
	font-family: var(--font-mono);
	font-size: 0.75rem;
	letter-spacing: 0.1em;
	text-decoration: underline;
}
</style>
