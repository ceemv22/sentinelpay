/*
 * DANGER — PERMANENT, IRREVERSIBLE WIPE.
 * Deletes EVERY Supabase auth user AND truncates ALL data in the Postgres DB.
 * There is no undo. Take a backup first if you might ever need anything.
 *
 * Run it where SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL are set
 * (e.g. the Railway "sentinelpay" service shell), from the api/ directory:
 *
 *     CONFIRM=WIPE node wipe-all.js
 *
 * Without CONFIRM=WIPE it refuses to do anything.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');

// Child tables first, parents last (TRUNCATE ... CASCADE handles FKs anyway).
const TABLES = [
  'UserSession', 'AccountDeletionRequest', 'PaymentSession', 'ScanHistory',
  'AuditLog', 'ApiKey', 'Invitation', 'ProcessedEvent', 'AddressCounter',
  'Organization', 'User'
];

async function main() {
  if (process.env.CONFIRM !== 'WIPE') {
    console.error('Refusing to run. Re-run with CONFIRM=WIPE to permanently wipe everything.');
    process.exit(1);
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
    process.exit(1);
  }

  // 1) Supabase Auth users FIRST — otherwise a live session would just re-create
  //    a Postgres user via the auth middleware right after you truncate.
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  let total = 0;
  for (;;) {
    const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw error;
    if (!data.users.length) break;
    for (const u of data.users) {
      const { error: delErr } = await sb.auth.admin.deleteUser(u.id);
      if (delErr) console.error('  ! failed to delete', u.email || u.id, '-', delErr.message);
      else total++;
    }
    console.log(`deleted ${total} auth users so far...`);
  }
  console.log(`[1/2] supabase auth wipe done — ${total} users removed`);

  // 2) Postgres data.
  const prisma = new PrismaClient();
  try {
    const list = TABLES.map((t) => `"${t}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`);
    console.log('[2/2] postgres wipe done — all tables truncated');
  } finally {
    await prisma.$disconnect();
  }

  console.log('ALL DONE. Remember to rotate DATABASE_URL and any exposed secrets.');
}

main().catch((e) => { console.error(e); process.exit(1); });
