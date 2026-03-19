<script lang="ts">
  import { signIn, signUp, passkey } from './auth';
  import { creds } from './stores';
  import { generateDeviceKeyPair, storePrivateKey } from './totem';
  import { fade } from 'svelte/transition';

  type Mode = 'sign-in' | 'sign-up';
  let mode = $state<Mode>('sign-in');
  let email = $state('');
  let name = $state('');
  let password = $state('');
  let error = $state('');
  let busy = $state(false);

  let { onclose }: { onclose?: () => void } = $props();

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
    // Accept both direct token (email/password) and BetterAuth session token (social)
    const betterAuthToken = result.data?.token ?? result.data?.session?.token ?? '';
    if (!betterAuthToken) {
      error = 'authentication failed — no token received';
      return;
    }
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
    const { seeker_id, access_token, refresh_token, handle, stage } = await r.json();
    if (access_token && seeker_id) {
      creds.login({ access_token, refresh_token: refresh_token ?? '', seeker_id, handle, stage });
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
      // Use popup flow to avoid losing guest session on redirect
      const result = await signIn.social({ provider, callbackURL: window.location.href, flow: 'popup' });
      // Popup flow returns directly; handle the auth result
      await handleCredResult(result as AuthResult);
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

  function handleClose() {
    onclose?.();
  }
</script>

<div class="veil" out:fade={{ duration: 2000 }} role="dialog" aria-modal="true" aria-label="sign in">
  <div class="inner">
    <button class="close-btn" onclick={handleClose} aria-label="Close">✕</button>

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
        {busy ? '…' : mode === 'sign-in' ? 'enter the temple' : 'begin'}
      </button>
    </form>

    <button class="toggle" onclick={() => { mode = mode === 'sign-in' ? 'sign-up' : 'sign-in'; error = ''; }}>
      {mode === 'sign-in' ? 'new seeker' : 'returning seeker'}
    </button>
  </div>
</div>

<style>
.veil {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--bg) 15%, transparent);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  animation: fadein 1.2s ease-out both;
}

@keyframes fadein { from { opacity: 0 } to { opacity: 1 } }

.inner {
  max-width: 380px;
  padding: 2.5rem 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  position: relative;
  animation: unblur-in 0.8s ease-out both;
  animation-delay: 0.8s;
}

@keyframes unblur-in {
  from {
    filter: blur(20px);
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    filter: blur(0);
    opacity: 1;
    transform: scale(1);
  }
}

.inner {
  max-width: 380px;
  padding: 2.5rem 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  position: relative;
  animation: scalein 1.2s ease-out both;
  animation-delay: 0.2s;
  transform-origin: center;
}

@keyframes scalein {
  from { opacity: 0; transform: scale(0.96); }
  to  { opacity: 1; transform: scale(1); }
}

.close-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
  padding: 0.3rem;
  transition: color 0.15s;
}
.close-btn:hover { color: var(--text); }

.quip {
  color: var(--text);
  font-size: 1rem;
  line-height: 1.7;
  font-style: italic;
}

button {
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
  margin: 0 auto;
}
.divider::before, .divider::after { content: ''; flex: 1; border-top: 1px solid var(--border); }

form { display: flex; flex-direction: column; gap: 1rem; width: 100%; }
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
