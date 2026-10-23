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
const { supabase } = require('../config/supabase');
const { sendStudentAccountResetNotice } = require('../services/emailService');

async function runWeeklyResetNow({ sendNotifications = true } = {}) {
  console.log(`[WEEKLY RESET] Starting student accounts wipe at ${new Date().toISOString()}`);

  try {
    const { data: accounts, error: accountError } = await supabase
      .from('accounts')
      .select('id, student_id, username')
      .eq('role', 'student')
      .eq('bulk_imported', false);

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
      .eq('bulk_imported', false);
    if (deleteError) throw deleteError;

    console.log(`[WEEKLY RESET] Deleted ${count ?? accounts.length} student account(s); legacy Excel-imported accounts preserved.`);
    console.log('[WEEKLY RESET] Complete. Permanent students records and Storage verification photos preserved intact.');
    return { success: true, count: count || 0 };
  } catch (error) {
    console.error('[WEEKLY RESET ERROR] Failed to perform weekly accounts wipe:', error);
    return { success: false, error: error.message };
  }
}

function initWeeklyResetCron() {
  // Cron schedule: Every Monday at 12:00 AM ("0 0 * * 1")
  const cronExpression = '0 0 * * 1';

  cron.schedule(cronExpression, async () => {
    console.log('[CRON TRIGGER] Monday 12:00 AM weekly reset triggered.');
    await runWeeklyResetNow();
  });

  console.log('✓ Weekly student accounts reset cron scheduled for Mondays at 12:00 AM (0 0 * * 1).');
}

module.exports = {
  initWeeklyResetCron,
  runWeeklyResetNow
};
