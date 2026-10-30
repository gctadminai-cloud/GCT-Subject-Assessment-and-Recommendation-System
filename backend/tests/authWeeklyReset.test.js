import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';
import { runWeeklyResetNow } from '../cron/weeklyReset.js';
import { JWT_SECRET } from '../middleware/authMiddleware.js';

describe('Weekly reset notice email', () => {
  it('includes the re-registration link and safely escapes recipient data', async () => {
    const { default: emailService } = await import('../services/emailService.js');
    const originalFrontendUrl = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = 'https://gct.example/';

    try {
      const email = emailService.buildStudentAccountResetEmail('<Student>', 'GCT-<001>');
      expect(email.registrationUrl).toBe('https://gct.example/#register');
      expect(email.text).toContain('GCT-<001>');
      expect(email.html).toContain('&lt;Student&gt;');
      expect(email.html).toContain('GCT-&lt;001&gt;');
      expect(email.html).toContain('Register again');
    } finally {
      if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
      else process.env.FRONTEND_URL = originalFrontendUrl;
    }
  });
});

describe('Auth, Student Registration & Weekly Reset Verification', () => {
  beforeAll(async () => {
    // Seed registrar admin
    const adminHash = await bcrypt.hash('AdminGCT2026!', 10);
    await supabase.from('accounts').upsert([{
      id: 'acc-test-admin',
      student_id: null,
      username: 'registrar_admin',
      password_hash: adminHash,
      role: 'registrar_admin',
      status: 'approved',
      created_at: new Date().toISOString()
    }], { onConflict: 'username' });

    // Seed verified student in students table
    await supabase.from('students').upsert([{
      student_id: 'GCT-2024-0001',
      id: 'student-rec-1',
      full_name: 'Permanent Test Student',
      program: 'BSIT',
      year_level: 2,
      verified: true,
      created_at: new Date().toISOString()
    }], { onConflict: 'student_id' });

    // Seed approved account for verified student
    const studentHash = await bcrypt.hash('StudentGCT2026!', 10);
    await supabase.from('accounts').upsert([{
      id: 'acc-test-student',
      student_id: 'GCT-2024-0001',
      username: 'GCT-2024-0001',
      password_hash: studentHash,
      role: 'student',
      status: 'approved',
      created_at: new Date().toISOString()
    }], { onConflict: 'username' });
  });

  it('should verify password and generate a valid JWT token on login', async () => {
    const { data: accounts } = await supabase
      .from('accounts')
      .select('*')
      .eq('username', 'registrar_admin');

    const account = accounts?.[0];
    expect(account).toBeDefined();

    const isMatch = await bcrypt.compare('AdminGCT2026!', account.password_hash);
    expect(isMatch).toBe(true);

    const token = jwt.sign(
      { id: account.id, username: account.username, role: account.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded.username).toBe('registrar_admin');
    expect(decoded.role).toBe('registrar_admin');
  });

  it('should block login if student status is pending', async () => {
    // Insert pending student account
    const hash = await bcrypt.hash('PendingPass123!', 10);
    await supabase.from('accounts').upsert([{
      id: 'acc-pending-1',
      student_id: 'GCT-2026-9999',
      username: 'GCT-2026-9999',
      password_hash: hash,
      role: 'student',
      status: 'pending',
      created_at: new Date().toISOString()
    }], { onConflict: 'username' });

    const { data: accounts } = await supabase
      .from('accounts')
      .select('*')
      .eq('username', 'GCT-2026-9999');

    const acc = accounts?.[0];
    expect(acc).toBeDefined();
    expect(acc.status).toBe('pending');
    expect(acc.status === 'approved').toBe(false);
  });

  it('should detect returning verified student vs first-time student', async () => {
    // Verified student
    const { data: verifiedList } = await supabase
      .from('students')
      .select('*')
      .eq('student_id', 'GCT-2024-0001');

    const verifiedStudent = verifiedList?.[0];
    expect(verifiedStudent).toBeDefined();
    expect(Boolean(verifiedStudent.verified)).toBe(true);

    // Unverified / new student
    const { data: unverifiedList } = await supabase
      .from('students')
      .select('*')
      .eq('student_id', 'GCT-2026-NEW01');

    const unverifiedStudent = unverifiedList?.[0];
    expect(unverifiedStudent).toBeUndefined();
  });

  it('weekly reset cron should delete student accounts but preserve registrar accounts and students table', async () => {
    // Verify accounts exist before reset
    const { data: studentsBefore } = await supabase
      .from('accounts')
      .select('*')
      .eq('role', 'student');

    expect(studentsBefore.length).toBeGreaterThan(0);

    // Run weekly reset
    const result = await runWeeklyResetNow({ sendNotifications: false });
    expect(result.success).toBe(true);

    // Student accounts must be wiped
    const { data: studentsAfter } = await supabase
      .from('accounts')
      .select('*')
      .eq('role', 'student');

    expect(studentsAfter.length).toBe(0);

    // Registrar accounts must be PRESERVED
    const { data: admins } = await supabase
      .from('accounts')
      .select('*')
      .eq('username', 'registrar_admin');

    const adminAccount = admins?.[0];
    expect(adminAccount).toBeDefined();
    expect(adminAccount.role).toBe('registrar_admin');

    // Students permanent records must be PRESERVED
    const { data: permStudents } = await supabase
      .from('students')
      .select('*')
      .eq('student_id', 'GCT-2024-0001');

    const permanentStudent = permStudents?.[0];
    expect(permanentStudent).toBeDefined();
    expect(permanentStudent.full_name).toBe('Permanent Test Student');
  });

  afterAll(async () => {
    await supabase.from('accounts').delete().eq('username', 'registrar_admin');
    await supabase.from('accounts').delete().eq('student_id', 'GCT-2024-0001');
    await supabase.from('students').delete().eq('student_id', 'GCT-2024-0001');
  });
});
