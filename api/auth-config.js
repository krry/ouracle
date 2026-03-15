import { betterAuth } from 'better-auth';
import { Pool } from '@neondatabase/serverless';
import { Kysely, PostgresDialect } from 'kysely';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new Kysely({ dialect: new PostgresDialect({ pool }) });

export const auth = betterAuth({
  database: { db, type: 'postgres' },
  baseURL: process.env.BETTER_AUTH_URL ?? 'https://api.ouracle.kerry.ink',
  emailAndPassword: { enabled: true },
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
      clientSecret: process.env.OAUTH_APPLE_CLIENT_SECRET,
    },
  },
  // passkey plugin requires better-auth ≥2.x; deferred until upgrade
  trustedOrigins: [
    'https://ouracle.kerry.ink',
    'http://localhost:2532',
    'https://localhost:2532',
    'http://localhost:5173',
    'http://souvenir.local:2532',
    'https://souvenir.local:2532',
  ],
});

export default auth;
