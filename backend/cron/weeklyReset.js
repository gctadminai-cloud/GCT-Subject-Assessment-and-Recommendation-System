/**
 * Weekly Account Reset Cron Job
 * Schedule: Every Monday at 12:00 AM (0 0 * * 1)
 * Purpose: Deletes student accounts from Supabase accounts table (role = 'student').
 * CRITICAL: NEVER deletes students table records or photos in Storage (permanent).
 * CRITICAL: NEVER deletes accounts where bulk_imported = true — those are the
 * 250 legacy accounts seeded from the registrar's Excel file
 * (backend/scripts/seedStudentsFromExcel.js), which keep their original
 * ID Number + Password permanently.
 */
const cron = require('node-cron');
const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase');
const { sendStudentAccountResetNotice, sendWeeklyPasswordRenewalEmail, sendWeeklyPasswordResetEarlyNotice } = require('../services/emailService');

function generateRandomPassword() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let pass = 'GCT-';
  for (let i = 0; i < 6; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

/**
 * Weekly Password Renewal & Reset for All Active Approved Students
 * Generates a random secure password for each student, hashes & updates database,
 * and emails each student with a notice that the password is only valid for ONE WEEK.
 */
async function rotateWeeklyStudentPasswordsNow({ sendNotifications = true } = {}) {
  console.log(`[WEEKLY RESET] Starting automatic weekly student password rotation at ${new Date().toISOString()}`);

  try {
    const { data: accounts, error: accountError } = await supabase
      .from('accounts')
      .select('id, student_id, username, status')
      .eq('role', 'student')
      .eq('status', 'approved');

    if (accountError) throw accountError;
    if (!accounts?.length) {
      console.log('[WEEKLY RESET] No approved student accounts found for password rotation.');
      return { success: true, count: 0, renewed: [] };
    }

    const studentIds = [...new Set(accounts.map(a => a.student_id).filter(Boolean))];
    const accountIds = accounts.map(a => a.id).filter(Boolean);

    const [studentsResult, profilesResult] = await Promise.all([
      studentIds.length
        ? supabase.from('students').select('student_id, email, full_name').in('student_id', studentIds)
        : Promise.resolve({ data: [], error: null }),
      accountIds.length
        ? supabase.from('profiles').select('id, email, full_name').in('id', accountIds)
        : Promise.resolve({ data: [], error: null })
    ]);

    const studentsById = new Map((studentsResult.data || []).map(s => [s.student_id, s]));
    const profilesById = new Map((profilesResult.data || []).map(p => [p.id, p]));

    const renewed = [];

    for (const account of accounts) {
      const studentId = account.student_id || account.username;
      const student = studentsById.get(studentId);
      const profile = profilesById.get(account.id);

      const targetEmail = student?.email?.trim() || profile?.email?.trim() || `${studentId.toLowerCase()}@student.gct.edu.ph`;
      const recipientName = student?.full_name || profile?.full_name || 'Student';

      const newPassword = generateRandomPassword();
      const passwordHash = await bcrypt.hash(newPassword, 10);

      // Update accounts table with fresh random password
      const { error: updateErr } = await supabase
        .from('accounts')
        .update({
          password_hash: passwordHash,
          status: 'approved'
        })
        .eq('id', account.id);

      if (updateErr) {
        console.warn(`[WEEKLY RESET] Failed to update password for student ${studentId}:`, updateErr.message);
        continue;
      }

      // Sync profiles table
      try {
        await supabase
          .from('profiles')
          .update({ password_hash: passwordHash, approval_status: 'approved' })
          .eq('id', account.id);
      } catch (pErr) {}

      // Dispatch renewal email with 1-week notice
      let delivered = false;
      if (sendNotifications && targetEmail) {
        const emailResult = await sendWeeklyPasswordRenewalEmail(
          targetEmail,
          recipientName,
          studentId,
          newPassword
        );
        delivered = Boolean(emailResult?.delivered);
      }

      renewed.push({
        studentId,
        recipientName,
        email: targetEmail,
        newPassword,
        delivered
      });
    }

    console.log(`[WEEKLY RESET] Successfully renewed passwords for ${renewed.length} student account(s) with 1-week validity notice.`);
    return { success: true, count: renewed.length, renewed };
  } catch (error) {
    console.error('[WEEKLY RESET ERROR] Failed to perform weekly password rotation:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Legacy/Test helper: Wipes test accounts if explicitly invoked
 */
async function runWeeklyResetNow({ sendNotifications = true, action = 'wipe' } = {}) {
  if (action === 'rotate') {
    return rotateWeeklyStudentPasswordsNow({ sendNotifications });
  }

  console.log(`[WEEKLY RESET] Starting student accounts wipe at ${new Date().toISOString()}`);

  try {
    const { data: accounts, error: accountError } = await supabase
      .from('accounts')
      .select('id, student_id, username')
      .eq('role', 'student')
      .or('bulk_imported.eq.false,bulk_imported.is.null');

    if (accountError) throw accountError;
    if (!accounts?.length) {
      console.log('[WEEKLY RESET] No student accounts are eligible for reset.');
      return { success: true, count: 0 };
    }

    const studentIds = [...new Set(accounts.map(account => account.student_id).filter(Boolean))];
    const accountIds = accounts.map(account => account.id).filter(Boolean);
    const [studentsResult, profilesResult] = await Promise.all([
      studentIds.length
        ? supabase.from('students').select('student_id, email, full_name').in('student_id', studentIds)
        : Promise.resolve({ data: [], error: null }),
      accountIds.length
        ? supabase.from('profiles').select('id, email, full_name').in('id', accountIds)
        : Promise.resolve({ data: [], error: null })
    ]);
    if (studentsResult.error) throw studentsResult.error;
    if (profilesResult.error) throw profilesResult.error;

    const studentsById = new Map((studentsResult.data || []).map(student => [student.student_id, student]));
    const profilesById = new Map((profilesResult.data || []).map(profile => [profile.id, profile]));
    const recipients = accounts.map(account => {
      const student = studentsById.get(account.student_id);
      const profile = profilesById.get(account.id);
      return {
        accountId: account.id,
        studentId: account.student_id || account.username,
        email: student?.email?.trim() || profile?.email?.trim() || '',
        name: student?.full_name || profile?.full_name || 'Student'
      };
    });

    const missingEmailCount = recipients.filter(recipient => !recipient.email).length;
    if (sendNotifications && missingEmailCount > 0) {
      throw new Error(`${missingEmailCount} reset-eligible student account(s) have no email address; reset cancelled.`);
    }

    if (sendNotifications) {
      const failedAccountIds = [];
      for (const recipient of recipients) {
        const result = await sendStudentAccountResetNotice(recipient.email, recipient.name, recipient.studentId);
        if (!result.success) failedAccountIds.push(recipient.accountId);
      }
      if (failedAccountIds.length > 0) {
        throw new Error(`Could not deliver reset notices to ${failedAccountIds.length} student account(s); reset cancelled.`);
      }
      console.log(`[WEEKLY RESET] Sent reset instructions to ${recipients.length} student account(s).`);
    }

    const { error: deleteError, count } = await supabase
      .from('accounts')
      .delete({ count: 'exact' })
      .in('id', accountIds)
      .eq('role', 'student')
      .or('bulk_imported.eq.false,bulk_imported.is.null');
    if (deleteError) throw deleteError;

    console.log(`[WEEKLY RESET] Deleted ${count ?? accounts.length} student account(s); legacy Excel-imported accounts preserved.`);
    return { success: true, count: count || 0 };
  } catch (error) {
    console.error('[WEEKLY RESET ERROR] Failed to perform weekly accounts wipe:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Advance Reminder Notice Dispatch
 * Queries all active approved student accounts and sends an early email notice
 * informing them that their passwords will reset on Monday at 12:00 AM.
 */
async function sendWeeklyResetEarlyNoticeToStudents() {
  console.log(`[WEEKLY RESET EARLY NOTICE] Starting early notice broadcast at ${new Date().toISOString()}`);

  try {
    const { data: accounts, error: accountError } = await supabase
      .from('accounts')
      .select('id, student_id, username, status')
      .eq('role', 'student')
      .eq('status', 'approved');

    if (accountError) throw accountError;
    if (!accounts?.length) {
      console.log('[WEEKLY RESET EARLY NOTICE] No approved student accounts found.');
      return { success: true, count: 0, notified: [] };
    }

    const studentIds = [...new Set(accounts.map(a => a.student_id).filter(Boolean))];
    const accountIds = accounts.map(a => a.id).filter(Boolean);

    const [studentsResult, profilesResult] = await Promise.all([
      studentIds.length
        ? supabase.from('students').select('student_id, email, full_name').in('student_id', studentIds)
        : Promise.resolve({ data: [], error: null }),
      accountIds.length
        ? supabase.from('profiles').select('id, email, full_name').in('id', accountIds)
        : Promise.resolve({ data: [], error: null })
    ]);

    const studentsById = new Map((studentsResult.data || []).map(s => [s.student_id, s]));
    const profilesById = new Map((profilesResult.data || []).map(p => [p.id, p]));

    const notified = [];

    for (const account of accounts) {
      const studentId = account.student_id || account.username;
      const student = studentsById.get(studentId);
      const profile = profilesById.get(account.id);

      const targetEmail = student?.email?.trim() || profile?.email?.trim() || `${studentId.toLowerCase()}@student.gct.edu.ph`;
      const recipientName = student?.full_name || profile?.full_name || 'Student';

      if (targetEmail) {
        const result = await sendWeeklyPasswordResetEarlyNotice(
          targetEmail,
          recipientName,
          studentId
        );
        notified.push({
          studentId,
          recipientName,
          email: targetEmail,
          delivered: Boolean(result?.delivered)
        });
      }
    }

    console.log(`[WEEKLY RESET EARLY NOTICE] Sent early notice to ${notified.length} student(s).`);
    return { success: true, count: notified.length, notified };
  } catch (error) {
    console.error('[WEEKLY RESET EARLY NOTICE ERROR] Failed to send early notice:', error);
    return { success: false, error: error.message };
  }
}

function initWeeklyResetCron() {
  // Cron schedule: Every Monday at 12:00 AM ("0 0 * * 1")
  const resetCronExpression = '0 0 * * 1';

  cron.schedule(resetCronExpression, async () => {
    console.log('[CRON TRIGGER] Monday 12:00 AM weekly student password reset triggered.');
    await rotateWeeklyStudentPasswordsNow({ sendNotifications: true });
  });

  // Early Notice Cron schedule: Every Sunday at 12:00 PM Noon ("0 12 * * 0") - 12 hours before reset
  const noticeCronExpression = '0 12 * * 0';

  cron.schedule(noticeCronExpression, async () => {
    console.log('[CRON TRIGGER] Sunday 12:00 PM weekly password reset early notice triggered.');
    await sendWeeklyResetEarlyNoticeToStudents();
  });

  console.log('✓ Weekly student password reset & renewal cron scheduled for Mondays at 12:00 AM (0 0 * * 1).');
  console.log('✓ Weekly reset early reminder notice scheduled for Sundays at 12:00 PM (0 12 * * 0).');
}

module.exports = {
  generateRandomPassword,
  initWeeklyResetCron,
  runWeeklyResetNow,
  rotateWeeklyStudentPasswordsNow,
  sendWeeklyResetEarlyNoticeToStudents
};

