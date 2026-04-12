import { betterAuth } from 'better-auth';
import { Pool } from '@neondatabase/serverless';
import { Kysely, PostgresDialect } from 'kysely';
import { SignJWT, importPKCS8 } from 'jose';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new Kysely({ dialect: new PostgresDialect({ pool }) });

async function appleClientSecret() {
  const { OAUTH_APPLE_CLIENT_SECRET: p8, OAUTH_APPLE_KEY_ID: kid, OAUTH_APPLE_TEAM_ID: teamId, OAUTH_APPLE_CLIENT_ID: clientId } = process.env;
  if (!p8 || !kid || !teamId || !clientId) return p8 ?? '';
  const key = await importPKCS8(p8.replace(/\\n/g, '\n'), 'ES256');
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + 15_552_000) // 6 months
    .setAudience('https://appleid.apple.com')
    .setSubject(clientId)
    .sign(key);
}

// Apple client secret must be a signed JWT — generate at startup.
let appleSecret;
try {
  appleSecret = await appleClientSecret();
  console.log('[apple] client secret JWT generated, kid prefix:', appleSecret.slice(0, 20));
} catch (e) {
  console.error('[apple] client secret generation failed:', e.message);
  appleSecret = '';
}

export const auth = betterAuth({
  database: { db, type: 'postgres' },
  baseURL: process.env.BETTER_AUTH_URL ?? 'https://api.ouracle.kerry.ink',
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 7,
  },
  socialProviders: {
    google: {
      clientId: process.env.OAUTH_GOOGLE_CLIENT_ID,
      clientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: process.env.OAUTH_GITHUB_CLIENT_ID,
      clientSecret: process.env.OAUTH_GITHUB_CLIENT_SECRET,
    },
    apple: {
      clientId: process.env.OAUTH_APPLE_CLIENT_ID,
      clientSecret: appleSecret,
    },
  },
  // passkey plugin requires better-auth ≥2.x; deferred until upgrade
  // Shared session cookies across all *.kerry.ink subdomains (Poiesis, etc.)
  // Set COOKIE_DOMAIN=.kerry.ink and BETTER_AUTH_SECRET to the same value on all apps.
  advanced: {
    crossSubDomainCookies: {
      enabled: !!process.env.COOKIE_DOMAIN,
      domain: process.env.COOKIE_DOMAIN ?? '',
    },
  },
  trustedOrigins: [
    'https://ouracle.kerry.ink',
    'https://poiesis.kerry.ink',
    'http://localhost:2532',
    'https://localhost:2532',
    'https://souvenir.local:2532',
    'http://localhost:3000',
  ].concat(
    process.env.NODE_ENV !== 'production'
      ? [
          'http://localhost:*',
          'https://localhost:*',
          'http://127.0.0.1:*',
          'https://127.0.0.1:*',
          'http://192.168.*:*',
          'https://192.168.*:*',
          'http://10.*:*',
          'https://10.*:*',
          'http://*.local:*',
          'https://*.local:*',
        ]
      : []
  ),
});

export default auth;
