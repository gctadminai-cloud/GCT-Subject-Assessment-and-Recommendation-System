/**
 * Setup Script:
 * 1. Exactly ONE Admin account with email 'gctadmin.ai@gmail.com' in Supabase.
 *    No staff accounts (admin will create staff accounts manually via User Management).
 * 2. Restore student 12718 ('AREVALO, MARK LESTER') in Supabase students, accounts, and profiles.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase');

async function setup() {
  console.log('=== Configuring Supabase: Single Admin & Restore Student 12718 ===');

  const now = new Date().toISOString();
  const adminPassword = process.env.REGISTRAR_ADMIN_PASSWORD || 'AdminGCT2026!';
  const adminHash = await bcrypt.hash(adminPassword, 10);
  const studentHash = await bcrypt.hash('password123', 10);

  // 1. Clean up old staff and admin rows in accounts table
  console.log('1. Cleaning up accounts table...');
  await supabase
    .from('accounts')
    .delete()
    .or('role.eq.registrar_staff,role.eq.registrar_admin,username.eq.staff,username.eq.registrar_staff,username.eq.registrar_admin,username.eq.admin');

  // 2. Clean up profiles table for staff and admin
  console.log('2. Cleaning up profiles table...');
  await supabase
    .from('profiles')
    .delete()
    .or('role.eq.registrar_staff,role.eq.registrar_admin,email.ilike.%@gct.edu.ph,email.eq.gctadmin.ai@gmail.com');

  // 3. Insert the SINGLE Admin account into accounts table
  console.log("3. Inserting single admin account with email 'gctadmin.ai@gmail.com'...");
  const { error: adminAccErr } = await supabase.from('accounts').insert([
    {
      id: 'acc-admin-main',
      student_id: null,
      username: 'admin',
      password_hash: adminHash,
      role: 'registrar_admin',
      status: 'approved',
      created_at: now
    }
  ]);
  if (adminAccErr) console.error('Admin account insert error:', adminAccErr);
  else console.log("✓ Admin account created (username: 'admin', role: registrar_admin)");

  // 4. Insert the SINGLE Admin profile with email 'gctadmin.ai@gmail.com'
  const { error: adminProfErr } = await supabase.from('profiles').insert([
    {
      id: 'acc-admin-main',
      email: 'gctadmin.ai@gmail.com',
      role: 'registrar_admin',
      full_name: 'System Administrator',
      approval_status: 'approved',
      created_at: now
    }
  ]);
  if (adminProfErr) console.error('Admin profile insert error:', adminProfErr);
  else console.log("✓ Admin profile created with email 'gctadmin.ai@gmail.com'");

  // 5. Restore Student 12718 in students table
  console.log('4. Restoring student 12718 (AREVALO, MARK LESTER)...');
  const { error: studentErr } = await supabase.from('students').upsert([
    {
      id: 'student-12718',
      student_id: '12718',
      full_name: 'AREVALO, MARK LESTER',
      email: '12718@student.gct.edu.ph',
      program: 'BSIT',
      year_level: 2,
      status: 'approved',
      verified: true,
      created_at: now
    }
  ], { onConflict: 'student_id' });
  if (studentErr) console.error('Student restore error:', studentErr);
  else console.log('✓ Student 12718 restored in students table');

  // 6. Restore Student 12718 in accounts table
  const { error: stAccErr } = await supabase.from('accounts').upsert([
    {
      id: 'acc-12718',
      student_id: '12718',
      username: '12718',
      password_hash: studentHash,
      role: 'student',
      status: 'approved',
      created_at: now
    }
  ], { onConflict: 'username' });
  if (stAccErr) console.error('Student account restore error:', stAccErr);
  else console.log("✓ Student 12718 account restored (username: '12718')");

  // 7. Restore Student 12718 in profiles table
  const { error: stProfErr } = await supabase.from('profiles').upsert([
    {
      id: 'acc-12718',
      email: '12718@student.gct.edu.ph',
      full_name: 'AREVALO, MARK LESTER',
      role: 'student',
      approval_status: 'approved',
      created_at: now
    }
  ], { onConflict: 'email' });
  if (stProfErr) console.error('Student profile restore error:', stProfErr);
  else console.log('✓ Student 12718 profile restored');

  console.log('=== Configuration Complete ===');
}

setup()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Setup failed:', err);
    process.exit(1);
  });
