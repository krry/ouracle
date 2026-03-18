
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

(async () => {
  await client.connect();
  
  // Mapping: current ID -> final desired number
  const finalMap = new Map([
    ['241d833a-f1e2-4ad6-bf88-565ff731c374', 5],
    ['27d1695c-3849-4699-8681-7447da4a0027', 8],
    ['41950383-1832-49de-be77-926aa251200e', 2],
    ['6484f8fe-68be-4451-9ec0-9add634e6006', 9],
    ['75b79453-2f44-4365-bc14-e6e551a547ce', 7],
    ['91828741-a5bd-427a-bd83-dd79ab59de30', 4],
    ['93e88e93-f73e-47a7-ae8d-bed948c250ee', 10],
    ['ad679517-35a3-4009-b12e-2edf3cd65a32', 6],
    ['d5f972db-63aa-465d-9984-4dbe04bfc2a8', 3],
    ['ed190360-d008-4dcd-8f33-3198a198c41d', 1]
  ]);
  
  // Phase 1: Set temporary numbers (add 100 to current number)
  const rows = await client.query('SELECT id, number FROM octave_steps');
  for (const row of rows.rows) {
    const tempNum = row.number + 1000;  // ensure no collision
    await client.query('UPDATE octave_steps SET number = $1 WHERE id = $2', [tempNum, row.id]);
  }
  console.log('✅ Phase 1: numbers set to temporary values');
  
  // Phase 2: Set final numbers
  for (const [id, finalNum] of finalMap) {
    await client.query('UPDATE octave_steps SET number = $1 WHERE id = $2', [finalNum, id]);
  }
  console.log('✅ Phase 2: numbers set to final values');
  
  // Phase 3: Fix next_step_number and previous_step_number
  await client.query(`
    UPDATE octave_steps o
    SET next_step_number = t.number
    FROM octave_steps t
    WHERE o.next_step_name IS NOT NULL
      AND o.next_step_name = t.name
  `);
  console.log('✅ next_step_number fixed');
  
  await client.query(`
    UPDATE octave_steps o
    SET previous_step_number = t.number
    FROM octave_steps t
    WHERE o.previous_step_name IS NOT NULL
      AND o.previous_step_name = t.name
  `);
  console.log('✅ previous_step_number fixed');
  
  await client.end();
  console.log('✅ All fixes applied');
})();
