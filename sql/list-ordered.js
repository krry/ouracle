
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await client.connect();
  const res = await client.query('SELECT number, name, element, chakra, next_step_number, previous_step_number FROM octave_steps ORDER BY number');
  console.log('Steps in narrative order:');
  res.rows.forEach(r => {
    console.log(`  ${r.number}. ${r.name} (${r.element}/${r.chakra}) → next: ${r.next_step_number} ← prev: ${r.previous_step_number}`);
  });
  await client.end();
})();
