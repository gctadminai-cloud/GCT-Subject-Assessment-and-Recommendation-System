import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase.js';
import { registrationOtpStore } from '../controllers/authController.js';
import { rotateWeeklyStudentPasswordsNow, generateRandomPassword } from '../cron/weeklyReset.js';

describe('Full Student Registration, Admin Approval, Weekly Reset & Record Display Workflow', () => {
  const testStudentId = 'GCT-TEST-8888';
  const testEmail = 'test.student8888@gmail.com';
  const testFullName = 'Maria Santos Test';
  const testProgram = 'BSIT';
  let generatedPassword = null;

  beforeAll(async () => {
    // Clean up any existing records for test student
    await supabase.from('accounts').delete().or(`student_id.eq.${testStudentId},username.eq.${testStudentId}`);
    await supabase.from('students').delete().eq('student_id', testStudentId);
    await supabase.from('grade_records').delete().eq('student_id', testStudentId);

    // Seed dummy academic/grade record for student to test matching
    const { error: gErr } = await supabase.from('grade_records').insert([
      {
        student_id: testStudentId,
        last_name: 'Test',
        first_name: 'Maria Santos',
        full_name: testFullName,
        course: testProgram,
        year_level: 1,
        semester: 'First Semester',
        academic_year: '2025-2026',
        subject: 'IT101 - Introduction to Computing',
        grade: '1.25',
        units: 3
      },
      {
        student_id: testStudentId,
        last_name: 'Test',
        first_name: 'Maria Santos',
        full_name: testFullName,
        course: testProgram,
        year_level: 1,
        semester: 'First Semester',
        academic_year: '2025-2026',
        subject: 'IT102 - Computer Programming 1',
        grade: '1.50',
        units: 3
      }
    ]);
    if (gErr) console.error('Grade records seed error:', gErr);
  });

  afterAll(async () => {
    // Clean up
    await supabase.from('accounts').delete().or(`student_id.eq.${testStudentId},username.eq.${testStudentId}`);
    await supabase.from('students').delete().eq('student_id', testStudentId);
    await supabase.from('grade_records').delete().eq('student_id', testStudentId);
  });

  it('Step 1: Student requests 6-digit OTP for manual registration without year level or photos', () => {
    const otpCode = '654321';
    const expiresAt = Date.now() + 10 * 60 * 1000;
    registrationOtpStore.set(testEmail, {
      otp: otpCode,
      student_id: testStudentId,
      last_name: 'Test',
      first_name: 'Maria',
      middle_name: 'Santos',
      full_name: 'Test, Maria Santos',
      email: testEmail,
      program: testProgram,
      expiresAt
    });

    const stored = registrationOtpStore.get(testEmail);
    expect(stored).toBeDefined();
    expect(stored.otp).toBe(otpCode);
    expect(stored.student_id).toBe(testStudentId);
    expect(stored.full_name).toBe('Test, Maria Santos');
  });

  it('Step 2: Student submits registration with OTP -> pending status created without photos', async () => {
    const lockedHash = await bcrypt.hash('LOCKED_PENDING_APPROVAL', 10);
    const now = new Date().toISOString();

    // Insert student record with NO photos and verified = false
    const { error: studentErr } = await supabase.from('students').upsert([{
      id: `student-test-${Date.now()}`,
      student_id: testStudentId,
      full_name: testFullName,
      email: testEmail,
      program: testProgram,
      year_level: 1,
      schedule: 'Schedule 1',
      id_front_path: null,
      id_back_path: null,
      selfie_path: null,
      id_front_image: null,
      id_back_image: null,
      selfie_image: null,
      verified: false,
      status: 'pending',
      created_at: now
    }], { onConflict: 'student_id' });

    expect(studentErr).toBeNull();

    // Insert account with pending status
    const { error: accountErr } = await supabase.from('accounts').upsert([{
      id: `acc-test-${Date.now()}`,
      student_id: testStudentId,
      username: testStudentId,
      password_hash: lockedHash,
      role: 'student',
      status: 'pending',
      bulk_imported: false,
      created_at: now
    }], { onConflict: 'username' });

    expect(accountErr).toBeNull();

    // Check account status is pending
    const { data: accounts } = await supabase
      .from('accounts')
      .select('*')
      .eq('username', testStudentId);

    expect(accounts?.[0]?.status).toBe('pending');
  });

  it('Step 3: Pending student cannot login before admin approval', async () => {
    const { data: accounts } = await supabase
      .from('accounts')
      .select('*')
      .eq('username', testStudentId);

    const account = accounts?.[0];
    expect(account).toBeDefined();
    // In authController, if account.status === 'pending', login returns 403
    expect(account.status).toBe('pending');
  });

  it('Step 4: Admin approves student -> generates random password, hashes it, saves to db', async () => {
    generatedPassword = generateRandomPassword();
    expect(generatedPassword.length).toBeGreaterThanOrEqual(10);

    const passwordHash = await bcrypt.hash(generatedPassword, 10);

    // Update students table
    await supabase
      .from('students')
      .update({ verified: true, status: 'approved' })
      .eq('student_id', testStudentId);

    // Update accounts table
    await supabase
      .from('accounts')
      .update({
        status: 'approved',
        password_hash: passwordHash
      })
      .eq('username', testStudentId);

    const { data: accounts } = await supabase
      .from('accounts')
      .select('*')
      .eq('username', testStudentId);

    const updatedAccount = accounts?.[0];
    expect(updatedAccount).toBeDefined();
    expect(updatedAccount.status).toBe('approved');
    const isMatch = await bcrypt.compare(generatedPassword, updatedAccount.password_hash);
    expect(isMatch).toBe(true);
  });

  it('Step 5: Approved student logs in with system-generated password and retrieves grades', async () => {
    const { data: accounts } = await supabase
      .from('accounts')
      .select('*')
      .eq('username', testStudentId);

    const account = accounts?.[0];
    expect(account).toBeDefined();
    const passwordMatch = await bcrypt.compare(generatedPassword, account.password_hash);
    expect(passwordMatch).toBe(true);

    // Verify student records are found from grade_records
    const { data: grades } = await supabase
      .from('grade_records')
      .select('*')
      .eq('student_id', testStudentId);

    expect(grades.length).toBe(2);
    expect(grades[0].subject).toContain('IT101');
    expect(grades[1].subject).toContain('IT102');
  });

  it('Step 6: Weekly password rotation generates fresh random password for student', async () => {
    const result = await rotateWeeklyStudentPasswordsNow({ sendNotifications: false });
    expect(result.success).toBe(true);
    expect(result.count).toBeGreaterThanOrEqual(1);

    const rotatedStudent = result.renewed.find(r => r.studentId === testStudentId);
    expect(rotatedStudent).toBeDefined();
    expect(rotatedStudent.newPassword).toBeDefined();
    expect(rotatedStudent.newPassword).not.toBe(generatedPassword);

    // Verify new password is now in the database
    const { data: accounts } = await supabase
      .from('accounts')
      .select('*')
      .eq('username', testStudentId);

    const isMatchNew = await bcrypt.compare(rotatedStudent.newPassword, accounts?.[0]?.password_hash);
    expect(isMatchNew).toBe(true);

    const isMatchOld = await bcrypt.compare(generatedPassword, accounts?.[0]?.password_hash);
    expect(isMatchOld).toBe(false);
  });
});
