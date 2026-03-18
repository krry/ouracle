
const { Client } = require('pg');
const fs = require('fs');
const client = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await client.connect();
  const sql = fs.readFileSync('sql/fix-step-ordering.sql', 'utf8');
  await client.query(sql);
  console.log('✅ Step ordering fixed');
  await client.end();
})().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
