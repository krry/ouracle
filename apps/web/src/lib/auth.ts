import { createAuthClient } from 'better-auth/client';
import { browser } from '$app/environment';

const RAW_BASE = import.meta.env.VITE_OURACLE_BASE_URL?.trim();
const BASE = RAW_BASE
  ? RAW_BASE
  : browser
    ? window.location.origin
    : 'https://localhost:2532';

// Proxy-based client: signIn.email(), signIn.social(), signUp.email(),
// and passkey.signIn(), passkey.register() are all available via dynamic proxy.
// better-auth 1.x ships passkey as a built-in proxy path with no separate plugin.
export const authClient = createAuthClient({
  baseURL: `${BASE}/api/auth`,
});

export const { signIn, signUp, signOut, useSession } = authClient;

// passkey is available at runtime via proxy but not in the TypeScript types for 1.5.5.
// Cast to a typed interface so callers get safety without fighting the type system.
export interface PasskeyClient {
  signIn: (options?: Record<string, unknown>) => Promise<{ data?: { token?: string; user?: { id: string; name?: string } } | null; error?: { message?: string } | null }>;
  register: (options?: Record<string, unknown>) => Promise<{ data?: unknown; error?: { message?: string } | null }>;
}

export const passkey = (authClient as unknown as { passkey: PasskeyClient }).passkey;
