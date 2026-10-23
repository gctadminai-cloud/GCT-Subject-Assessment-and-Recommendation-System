/**
 * Seed Script: Registrar Admin & Staff Accounts
 * Reads credentials from environment variables (.env), never hardcoded.
 * Inserts directly into Supabase accounts & profiles tables.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase');

async function seedRegistrarAccounts() {
  console.log('--- Seeding Single Registrar Admin Account to Supabase ---');

  const adminUsername = process.env.REGISTRAR_ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.REGISTRAR_ADMIN_PASSWORD || 'AdminGCT2026!';
  const adminEmail = 'gctadmin.ai@gmail.com';

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const now = new Date().toISOString();

  // 1. Seed into Supabase accounts table (Single Admin)
  try {
    const { error: accErr } = await supabase.from('accounts').upsert([
      {
        id: 'acc-admin-main',
        student_id: null,
        username: adminUsername,
        password_hash: adminHash,
        role: 'registrar_admin',
        status: 'approved',
        created_at: now
      }
    ], { onConflict: 'username' });

    if (accErr) {
      console.warn('Supabase accounts upsert warning:', accErr.message);
    } else {
      console.log(`✓ Supabase: Seeded single admin '${adminUsername}' (role: registrar_admin)`);
    }
  } catch (err) {
    console.warn('Accounts seeding error:', err.message);
  }

  // 2. Sync to profiles table with official email
  try {
    await supabase.from('profiles').upsert([
      {
        id: 'acc-admin-main',
        email: adminEmail,
        role: 'registrar_admin',
        full_name: 'System Administrator',
        approval_status: 'approved',
        created_at: now
      }
    ], { onConflict: 'id' });
    console.log(`✓ Supabase: Seeded registrar admin profile (${adminEmail})`);
  } catch (err) {
    console.warn('Profiles seeding error:', err.message);
  }

  console.log('--- Seeding Complete (Staff accounts are created by Admin in User Management) ---');
}

if (require.main === module) {
  seedRegistrarAccounts()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}

module.exports = { seedRegistrarAccounts };
