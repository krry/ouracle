import { betterAuth } from 'better-auth';
import { passkey } from 'better-auth/plugins/passkey';
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const auth = betterAuth({
  database: { db: pool, type: 'pg' },
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
  plugins: [passkey()],
  trustedOrigins: [
    'https://ouracle.kerry.ink',
    'http://localhost:5173',
  ],
});
