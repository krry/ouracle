import { betterAuth } from 'better-auth';
import { passkey } from 'better-auth/plugins/passkey';
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const auth = betterAuth({
  database: { db: pool, type: 'pg' },
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET },
    github: { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET },
    // Apple OAuth deferred
  },
  plugins: [passkey()],
  trustedOrigins: [
    'https://ouracle.kerry.ink',
    'http://localhost:5173',
  ],
});
