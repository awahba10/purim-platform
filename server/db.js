const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn(
    '[db] DATABASE_URL is not set. Copy .env.example to .env and set your local Postgres URL.'
  );
}

// Hosted Postgres providers (Neon, Render, Supabase, etc.) require SSL.
// A local Postgres install does not. Rule: use SSL for everything except
// a connection to localhost. Override with PGSSL=true / PGSSL=false.
function resolveSsl(cs) {
  if (process.env.PGSSL === 'true') return { rejectUnauthorized: false };
  if (process.env.PGSSL === 'false') return false;
  if (!cs) return false;
  const isLocal = /\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])(:|\/)/.test(cs);
  return isLocal ? false : { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString,
  ssl: resolveSsl(connectionString),
});

pool.on('error', (err) => {
  console.error('[db] unexpected error on idle client', err);
});

module.exports = { pool };
