<script lang="ts">
  import { signIn, signUp, passkey } from './auth';
  import { creds } from './stores';
  import { generateDeviceKeyPair, storePrivateKey } from './totem';

  type Mode = 'sign-in' | 'sign-up';
  let mode = $state<Mode>('sign-in');
  let email = $state('');
  let name = $state('');
  let password = $state('');
  let error = $state('');
  let busy = $state(false);

  const BASE = import.meta.env.VITE_OURACLE_BASE_URL ?? 'https://api.ouracle.kerry.ink';

  async function registerDeviceKey(token: string) {
    try {
      const { publicKeyJwk, privateKey } = await generateDeviceKeyPair();
      await storePrivateKey(privateKey);
      await fetch(`${BASE}/totem/devices`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_name: navigator.userAgent.slice(0, 64), public_key: JSON.stringify(publicKeyJwk) }),
      });
    } catch {
      // non-fatal — device key can be registered later
    }
  }

  // BetterAuth 1.x returns { data, error } — data.token is the session token,
  // data.user has { id, name, email, ... }.
  // We must exchange the BetterAuth session token for our custom JWT via /auth/social-exchange.
  type AuthResult = {
    data?: { token?: string; user?: { id: string; name?: string } } | null;
    error?: { message?: string } | null;
  };

  async function handleCredResult(result: AuthResult) {
    if (result.error) {
      error = result.error.message ?? 'something went wrong';
      return;
    }
    const betterAuthToken = result.data?.token ?? '';
    if (!betterAuthToken) return;
    // Exchange BetterAuth session token for our custom JWT
    const r = await fetch(`${BASE}/auth/social-exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: betterAuthToken }),
    });
    if (!r.ok) {
      error = 'authentication failed — please try again';
      return;
    }
    const { seeker_id, access_token, refresh_token, handle } = await r.json();
    if (access_token && seeker_id) {
      creds.login({ access_token, refresh_token: refresh_token ?? '', seeker_id, handle });
      await registerDeviceKey(access_token);
    }
  }

  async function submit() {
    error = '';
    busy = true;
    try {
      if (mode === 'sign-up') {
        const result = await signUp.email({ email, password, name });
        await handleCredResult(result as AuthResult);
      } else {
        const result = await signIn.email({ email, password });
        await handleCredResult(result as AuthResult);
      }
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'something went wrong';
    } finally {
      busy = false;
    }
  }

  async function socialSignIn(provider: 'google' | 'github' | 'apple') {
    error = '';
    busy = true;
    try {
      const result = await signIn.social({ provider, callbackURL: window.location.href });
      // If the SDK returned a URL instead of auto-redirecting, navigate manually
      const url = (result as { data?: { url?: string } })?.data?.url;
      if (url) window.location.href = url;
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'something went wrong';
    } finally {
      busy = false;
    }
  }

  async function passkeySignIn() {
    error = '';
    busy = true;
    try {
      // passkey.signIn() is the authenticate flow in better-auth 1.x
      const result = await passkey.signIn();
      await handleCredResult(result as AuthResult);
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
    <p class="sub">hear and be heard.</p>
  </header>

  <div class="social-row">
    <button class="social" onclick={() => socialSignIn('apple')} disabled={busy}>Apple</button>
    <button class="social" onclick={() => socialSignIn('google')} disabled={busy}>Google</button>
    <button class="social" onclick={() => socialSignIn('github')} disabled={busy}>GitHub</button>
  </div>

  <div class="divider"><span>or</span></div>

  <form onsubmit={(e) => { e.preventDefault(); submit(); }}>
    {#if mode === 'sign-up'}
      <label>
        <span>name</span>
        <input bind:value={name} type="text" autocomplete="name" required />
      </label>
    {/if}
    <label>
      <span>email</span>
      <input bind:value={email} type="email" autocomplete="email" required />
    </label>
    <label>
      <span>password</span>
      <input bind:value={password} type="password"
        autocomplete={mode === 'sign-up' ? 'new-password' : 'current-password'} required />
    </label>

    {#if error}<p class="error">{error}</p>{/if}

    <button type="submit" class="primary" disabled={busy}>
      {busy ? '…' : mode === 'sign-in' ? 'enter' : 'begin'}
    </button>
  </form>

  <button class="toggle" onclick={() => { mode = mode === 'sign-in' ? 'sign-up' : 'sign-in'; error = ''; }}>
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
  gap: 1.5rem;
  padding: 2rem;
}
header { text-align: center; }
h1 { font-size: 2rem; letter-spacing: 0.2em; color: var(--accent); }
.sub { color: var(--muted); font-size: 0.8rem; letter-spacing: 0.15em; margin-top: 0.4rem; }
.social-row { display: flex; gap: 0.75rem; }
.social {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--muted);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  padding: 0.5rem 1rem;
  transition: border-color 0.15s, color 0.15s;
}
.social:hover { border-color: var(--accent); color: var(--accent); }
.divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
  max-width: 300px;
  color: var(--muted);
  font-size: 0.75rem;
}
.divider::before, .divider::after { content: ''; flex: 1; border-top: 1px solid var(--border); }
form { display: flex; flex-direction: column; gap: 1rem; width: 100%; max-width: 300px; }
label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.75rem; color: var(--muted); letter-spacing: 0.1em; }
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
.primary {
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
.primary:disabled { opacity: 0.4; cursor: default; }
.error { color: hsl(0, 60%, 65%); font-size: 0.8rem; }
.toggle {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-decoration: underline;
}
</style>
