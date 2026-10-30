const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase');
const { getSignedPhotoUrl, LOCAL_UPLOAD_DIR } = require('../services/storageService');
const { sendStudentApprovalPassword } = require('../services/emailService');
const { generateRandomPassword, rotateWeeklyStudentPasswordsNow, sendWeeklyResetEarlyNoticeToStudents } = require('../cron/weeklyReset');

/**
 * Staff/Admin view all students with verification status and photo URLs.
 */
async function getAllStudents(req, res) {
  try {
    // Paginate students table to avoid PostgREST 1000 row truncation
    let studentsData = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      studentsData.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    const { data: accountsData } = await supabase
      .from('accounts')
      .select('*')
      .limit(50000);

    const accountsMap = new Map();
    (accountsData || []).forEach(a => {
      if (a.student_id) accountsMap.set(a.student_id, a);
      if (a.username) accountsMap.set(a.username, a);
    });

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at')
      .limit(50000);

    const profilesMap = new Map();
    (profilesData || []).forEach(p => {
      if (p.id) profilesMap.set(p.id, p);
      if (p.email && p.email.includes('@')) {
        const handle = p.email.split('@')[0].toLowerCase();
        profilesMap.set(handle, p);
      }
    });

    // Fast deficiency detection so students are accurately tagged as regular vs deficient on load
    const activeDeficiencyCounts = new Map();
    try {
      const { data: failedGrades } = await supabase
        .from('grade_records')
        .select('student_id, subject, grade, raw_grade')
        .or('grade.eq.5,raw_grade.eq.5,raw_grade.eq.9,grade.gt.3')
        .limit(50000);

      if (failedGrades && failedGrades.length > 0) {
        const studentIds = Array.from(new Set(failedGrades.map(f => f.student_id).filter(Boolean)));
        const { data: passChecks } = await supabase
          .from('grade_records')
          .select('student_id, subject, grade')
          .in('student_id', studentIds)
          .lte('grade', 3)
          .gt('grade', 0)
          .limit(50000);

        const passedMap = new Set((passChecks || []).map(p => `${String(p.student_id).replace(/^GCT-/i, '')}::${(p.subject || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`));

        failedGrades.forEach(f => {
          const cleanSId = String(f.student_id).replace(/^GCT-/i, '');
          const key = `${cleanSId}::${(f.subject || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
          if (!passedMap.has(key)) {
            const curDef = activeDeficiencyCounts.get(cleanSId) || 0;
            activeDeficiencyCounts.set(cleanSId, curDef + 1);
            activeDeficiencyCounts.set(f.student_id, curDef + 1);
          }
        });
      }
    } catch (defErr) {
      console.warn('Failed to pre-compute student deficiencies:', defErr);
    }

    // Dynamic standing year level and semester calculation based on actual grade data
    let studentStandingYears = new Map();
    let studentActiveSemesters = new Map();
    let studentSemestersByAy = new Map();
    let studentAcademicYears = new Map();

    const now = Date.now();
    if (global._cachedStudentSummaries && (now - global._cachedStudentSummariesTime < 180000)) {
      studentStandingYears = global._cachedStudentSummaries.standingYears;
      studentActiveSemesters = global._cachedStudentSummaries.activeSemesters;
      studentSemestersByAy = global._cachedStudentSummaries.semestersByAy;
      studentAcademicYears = global._cachedStudentSummaries.academicYears;
    } else {
      try {
        let grRows = [];
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error } = await supabase
            .from('grade_records')
            .select('student_id, year_level, semester, academic_year')
            .range(from, from + pageSize - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          grRows.push(...data);
          if (data.length < pageSize) break;
          from += pageSize;
        }

        const studentGradesMap = new Map();
        grRows.forEach(g => {
          const sid = String(g.student_id).trim();
          const clean = sid.replace(/^GCT-/i, '');
          if (!studentGradesMap.has(sid)) studentGradesMap.set(sid, []);
          studentGradesMap.get(sid).push(g);
          if (clean !== sid) {
            if (!studentGradesMap.has(clean)) studentGradesMap.set(clean, []);
            studentGradesMap.get(clean).push(g);
          }
        });

        studentGradesMap.forEach((grades, sid) => {
          let maxYear = 1;
          const sem2Counts = new Map();
          let hasSummerYear3 = false;

          let maxAyYr = 0;
          let latestSemRank = 0;
          let latestSem = '1';
          const semsByAy = {};
          const aySet = new Set();
          let hasSummer = false;

          grades.forEach(g => {
            const y = Number(g.year_level || 1);
            if (Number.isFinite(y) && y >= 1 && y <= 4 && y > maxYear) maxYear = y;
            const ay = (g.academic_year || '').trim();
            const raw = String(g.semester).toLowerCase().trim();
            const isSem2 = raw.includes('second') || raw === '2' || raw.includes('2nd');
            const isSummer = raw.includes('summer') || raw === '3';

            if (isSem2 && Number.isFinite(y)) {
              sem2Counts.set(y, (sem2Counts.get(y) || 0) + 1);
            }
            if (isSummer) {
              hasSummer = true;
              if (y === 3) hasSummerYear3 = true;
            }

            let semRank = 1;
            let semKey = '1';
            if (isSummer) { semRank = 3; semKey = 'summer'; }
            else if (isSem2) { semRank = 2; semKey = '2'; }

            if (ay) {
              aySet.add(ay);
              const yr = parseInt(ay.split('-')[0] || '0', 10);
              if (yr > maxAyYr || (yr === maxAyYr && semRank > latestSemRank)) {
                maxAyYr = yr;
                latestSemRank = semRank;
                latestSem = semKey;
              }

              const prevAySem = semsByAy[ay];
              const prevRank = prevAySem === 'summer' ? 3 : (prevAySem === '2' ? 2 : (prevAySem === '1' ? 1 : 0));
              if (semRank > prevRank) {
                semsByAy[ay] = semKey;
              }
            } else {
              if (semRank > latestSemRank) {
                latestSemRank = semRank;
                latestSem = semKey;
              }
            }
          });

          let calculatedYear = maxYear;
          if ((sem2Counts.get(1) || 0) >= 3) calculatedYear = Math.max(calculatedYear, 2);
          if ((sem2Counts.get(2) || 0) >= 3) calculatedYear = Math.max(calculatedYear, 3);
          // Year 3 -> 4: requires completing 3rd Year Summer OR taking Year 4 subjects (maxYear >= 4).
          // Completing 3rd Year 2nd Sem keeps the student in 3rd Year because Summer is still required!
          if (hasSummerYear3 || maxYear >= 4) calculatedYear = Math.max(calculatedYear, 4);
          calculatedYear = Math.min(4, Math.max(1, calculatedYear));
          studentStandingYears.set(sid, calculatedYear);

          let activeSem = latestSem;
          if (hasSummer && (latestSem === 'summer' || aySet.size <= 3)) {
            activeSem = 'summer';
          }

          studentActiveSemesters.set(sid, activeSem);
          studentSemestersByAy.set(sid, semsByAy);
          studentAcademicYears.set(sid, Array.from(aySet));
        });

        global._cachedStudentSummaries = {
          standingYears: studentStandingYears,
          activeSemesters: studentActiveSemesters,
          semestersByAy: studentSemestersByAy,
          academicYears: studentAcademicYears
        };
        global._cachedStudentSummariesTime = now;
      } catch (yrErr) {
        console.warn('Failed to pre-compute student standing years and semesters:', yrErr);
      }
    }

    const students = (studentsData || []).map(r => {
      const idFrontUrl = null;
      const idBackUrl = null;
      const selfieUrl = null;

      const acct = accountsMap.get(r.student_id);
      const prof = (acct?.id ? profilesMap.get(acct.id) : null) || profilesMap.get(r.student_id?.toLowerCase());
      const approvalStatus = acct?.status || (r.verified ? 'approved' : 'pending');
      const realEmail = r.email || prof?.email || `${r.student_id.toLowerCase()}@student.gct.edu.ph`;
      const realCreatedAt = acct?.created_at || r.created_at || prof?.created_at || new Date().toISOString();

      const hasAccount = Boolean(acct);
      const defCount = activeDeficiencyCounts.get(r.student_id) || 0;
      const cleanSId = String(r.student_id).replace(/^GCT-/i, '');
      const hasGrades = studentStandingYears.has(r.student_id) || studentStandingYears.has(cleanSId);
      const dbY = Number(r.year_level || 1);
      const computedStanding = hasGrades
        ? (studentStandingYears.get(r.student_id) || studentStandingYears.get(cleanSId) || dbY)
        : dbY;
      // When grade records exist, student's actual academic standing is computed from attended terms
      const effectiveYearLevel = hasGrades ? computedStanding : dbY;

      // Keep database students.year_level synchronized with accurate standing
      if (hasGrades && effectiveYearLevel !== dbY) {
        supabase
          .from('students')
          .update({ year_level: effectiveYearLevel })
          .eq('id', r.id)
          .then(() => {})
          .catch(() => {});
      }

      return {
        id: r.id || r.student_id,
        student_id: r.student_id,
        full_name: r.full_name,
        email: realEmail,
        program: r.program,
        year_level: effectiveYearLevel,
        schedule: r.schedule || null,
        section: (r.section && !String(r.section).toLowerCase().includes('schedule')) ? r.section : null,
        verified: Boolean(r.verified),
        status: hasAccount ? approvalStatus : 'unregistered',
        has_account: hasAccount,
        has_deficiencies: defCount > 0,
        hasDeficiencies: defCount > 0,
        deficiency_count: defCount,
        deficiencyCount: defCount,
        active_semester: studentActiveSemesters.get(r.student_id) || studentActiveSemesters.get(cleanSId) || '1',
        activeSemester: studentActiveSemesters.get(r.student_id) || studentActiveSemesters.get(cleanSId) || '1',
        semesters_by_ay: studentSemestersByAy.get(r.student_id) || studentSemestersByAy.get(cleanSId) || {},
        academic_years: studentAcademicYears.get(r.student_id) || studentAcademicYears.get(cleanSId) || [],
        id_front_url: idFrontUrl,
        id_back_url: idBackUrl,
        selfie_url: selfieUrl,
        id_front_image: idFrontUrl,
        id_back_image: idBackUrl,
        selfie_image: selfieUrl,
        created_at: realCreatedAt,
        profiles: {
          id: acct?.id || r.student_id,
          full_name: r.full_name,
          email: realEmail,
          role: acct?.role || 'student',
          approval_status: hasAccount ? approvalStatus : 'unregistered',
          created_at: realCreatedAt,
          has_account: hasAccount
        }
      };
    });

    res.json(students);
  } catch (error) {
    console.error('Get All Students Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get pending student verifications requiring Registrar review.
 */
async function getPendingVerifications(req, res) {
  try {
    const { data: studentsData, error: sErr } = await supabase
      .from('students')
      .select('*')
      .limit(50000)
      .order('created_at', { ascending: false });

    if (sErr) throw sErr;

    const { data: accountsData } = await supabase
      .from('accounts')
      .select('*')
      .limit(50000);

    const accountsMap = new Map();
    (accountsData || []).forEach(a => {
      if (a.student_id) accountsMap.set(a.student_id, a);
    });

    const pendingRows = (studentsData || []).filter(s => {
      const acct = accountsMap.get(s.student_id);
      return !s.verified || acct?.status === 'pending';
    });

    const pending = pendingRows.map(r => {
      const acct = accountsMap.get(r.student_id);
      return {
        student_id: r.student_id,
        full_name: r.full_name,
        program: r.program,
        year_level: r.year_level,
        email: r.email || `${r.student_id.toLowerCase()}@student.gct.edu.ph`,
        schedule: r.schedule || null,
        verified: Boolean(r.verified),
        account_status: acct?.status || 'pending',
        created_at: r.created_at
      };
    });

    res.json(pending);
  } catch (error) {
    console.error('Get Pending Verifications Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get single student details
 */
async function getStudentById(req, res) {
  try {
    const { id } = req.params;
    const cleanId = String(id || '').trim();
    const strippedId = cleanId
      .replace(/^s-/i, '')
      .replace(/^student-/i, '')
      .replace(/^acc-/i, '')
      .replace(/^GCT-/i, '')
      .trim();
    const bareId = strippedId.replace(/^GCT-/i, '').trim();
    const withGct = `GCT-${bareId}`;
    const idVariants = Array.from(new Set([cleanId, strippedId, bareId, withGct])).filter(Boolean);
    const orFilter = idVariants.map(v => `student_id.eq.${v},id.eq.${v}`).join(',');

    const { data: students } = await supabase
      .from('students')
      .select('*')
      .or(orFilter)
      .limit(1);

    const row = students?.[0];
    if (!row) {
      return res.status(404).json({ error: 'Student record not found' });
    }

    const { data: accounts } = await supabase
      .from('accounts')
      .select('*')
      .or(`student_id.eq.${row.student_id},username.eq.${row.student_id}`)
      .limit(1);

    const acct = accounts?.[0] || null;

    const idFrontUrl = null;
    const idBackUrl = null;
    const selfieUrl = null;

    // Calculate accurate standing year level from actual grade data
    let effectiveYear = Number(row.year_level || 1);
    try {
      const { data: gr } = await supabase
        .from('grade_records')
        .select('year_level, semester')
        .in('student_id', idVariants);

      if (gr && gr.length > 0) {
        let maxYear = 1;
        const sem2Counts = new Map();
        let hasSummerYear3 = false;
        gr.forEach(g => {
          const y = Number(g.year_level || 1);
          if (Number.isFinite(y) && y >= 1 && y <= 4 && y > maxYear) maxYear = y;
          const isSem2 = String(g.semester).toLowerCase().includes('second') || String(g.semester) === '2';
          const isSummer = String(g.semester).toLowerCase().includes('summer') || String(g.semester) === '3';
          if (isSem2 && Number.isFinite(y)) {
            sem2Counts.set(y, (sem2Counts.get(y) || 0) + 1);
          }
          if (isSummer && y === 3) {
            hasSummerYear3 = true;
          }
        });

        effectiveYear = maxYear;
        // Year 1 -> 2: completing 2nd sem of Year 1
        if ((sem2Counts.get(1) || 0) >= 3) {
          effectiveYear = Math.max(effectiveYear, 2);
        }
        // Year 2 -> 3: completing 2nd sem of Year 2
        if ((sem2Counts.get(2) || 0) >= 3) {
          effectiveYear = Math.max(effectiveYear, 3);
        }
        // Year 3 -> 4: requires completing 3rd Year Summer OR taking Year 4 subjects (maxYear >= 4).
        // Completing 3rd Year 2nd Sem keeps the student in 3rd Year because Summer is still required!
        if (hasSummerYear3 || maxYear >= 4) {
          effectiveYear = Math.max(effectiveYear, 4);
        }
        effectiveYear = Math.min(4, Math.max(1, effectiveYear));

        if (Number(row.year_level) !== effectiveYear) {
          supabase.from('students').update({ year_level: effectiveYear }).eq('id', row.id).then(() => {}).catch(() => {});
        }
      }
    } catch (e) {}

    res.json({
      id: row.id || row.student_id,
      student_id: row.student_id,
      full_name: row.full_name,
      program: row.program,
      year_level: effectiveYear,
      schedule: row.schedule || null,
      verified: Boolean(row.verified),
      id_front_url: idFrontUrl,
      id_back_url: idBackUrl,
      selfie_url: selfieUrl,
      created_at: row.created_at,
      profiles: {
        id: acct?.id || row.student_id,
        full_name: row.full_name,
        role: acct?.role || 'student',
        approval_status: acct?.status || (row.verified ? 'approved' : 'pending'),
        created_at: acct?.created_at || row.created_at
      }
    });
  } catch (error) {
    console.error('Get Student Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Registrar Review & Approval of Student Registration
 * Sets verified = true in students and status = 'approved' in accounts.
 */
async function updateStudentApproval(req, res) {
  try {
    const { id } = req.params; // student_id or account id
    const approval_status = req.body.approval_status || req.body.action || req.body.status; // 'approved' or 'rejected'

    if (!['approved', 'rejected', 'pending'].includes(approval_status)) {
      return res.status(400).json({ error: 'Invalid approval_status value. Must be approved, rejected, or pending.' });
    }

    // 1. Identify student_id
    let studentId = id;
    const { data: students } = await supabase
      .from('students')
      .select('*')
      .or(`student_id.eq.${id},id.eq.${id}`)
      .limit(1);

    const studentRow = students?.[0] || null;
    if (studentRow?.student_id) {
      studentId = studentRow.student_id;
    }

    // 2. Update students table (verified = true if approved)
    const isVerified = approval_status === 'approved';
    await supabase
      .from('students')
      .update({ verified: isVerified, status: approval_status })
      .or(`student_id.eq.${studentId},id.eq.${studentId}`);

    let generatedPassword = null;
    const targetEmail = studentRow?.email || `${studentId.toLowerCase()}@student.gct.edu.ph`;
    const targetName = studentRow?.full_name || studentId;

    if (approval_status === 'approved') {
      // Generate secure random password valid for one week
      generatedPassword = generateRandomPassword();
      const passwordHash = await bcrypt.hash(generatedPassword, 10);
      const now = new Date().toISOString();

      // Upsert into accounts table
      const { data: existingAccounts } = await supabase
        .from('accounts')
        .select('*')
        .or(`student_id.eq.${studentId},username.eq.${studentId}`)
        .limit(1);

      if (existingAccounts && existingAccounts.length > 0) {
        await supabase
          .from('accounts')
          .update({
            status: 'approved',
            password_hash: passwordHash,
            role: 'student',
            bulk_imported: false
          })
          .or(`student_id.eq.${studentId},username.eq.${studentId}`);
      } else {
        await supabase
          .from('accounts')
          .insert([{
            id: `acc-${Date.now()}`,
            student_id: studentId,
            username: studentId,
            password_hash: passwordHash,
            role: 'student',
            status: 'approved',
            bulk_imported: false,
            created_at: now
          }]);
      }

      // Sync profiles table for backwards compatibility
      const profileFilters = [`id.eq.${id}`, `email.ilike.${studentId.toLowerCase()}%`];
      if (studentRow?.email) profileFilters.push(`email.eq.${studentRow.email}`);
      await supabase
        .from('profiles')
        .update({ approval_status: 'approved', password_hash: passwordHash })
        .or(profileFilters.join(','));

      // Derive request origin (e.g. from Vercel deployment when admin approves student)
      let requestOrigin = req?.headers?.origin || null;
      if (!requestOrigin && req?.headers?.referer) {
        try {
          requestOrigin = new URL(req.headers.referer).origin;
        } catch (_) {}
      }
      if (!requestOrigin && req?.headers?.['x-forwarded-host']) {
        const proto = req.headers['x-forwarded-proto'] || 'https';
        requestOrigin = `${proto}://${req.headers['x-forwarded-host']}`;
      }

      // Send system-generated password to student's Gmail with 1-week notice
      await sendStudentApprovalPassword(targetEmail, targetName, studentId, generatedPassword, requestOrigin);

      console.log(`✅ [STUDENT APPROVAL] Student ${studentId} (${targetName}) approved. Password sent to ${targetEmail}.`);

      return res.json({
        message: `Student ${studentId} registration approved! System-generated password sent to ${targetEmail} (valid for 1 week).`,
        studentId,
        approval_status: 'approved',
        verified: true,
        generatedPassword,
        email: targetEmail
      });
    }

    if (approval_status === 'rejected') {
      await supabase
        .from('accounts')
        .update({ status: 'rejected' })
        .or(`student_id.eq.${studentId},username.eq.${studentId}`);

      const profileFilters = [`id.eq.${id}`, `email.ilike.${studentId.toLowerCase()}%`];
      if (studentRow?.email) profileFilters.push(`email.eq.${studentRow.email}`);
      await supabase
        .from('profiles')
        .update({ approval_status: 'rejected' })
        .or(profileFilters.join(','));

      return res.json({
        message: `Student ${studentId} registration was rejected.`,
        studentId,
        approval_status: 'rejected',
        verified: false
      });
    }

    res.json({
      message: `Student ${studentId} verification set to '${approval_status}'`,
      studentId,
      approval_status,
      verified: isVerified
    });
  } catch (error) {
    console.error('Update Student Approval Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Manual trigger for weekly student password reset (Admin only)
 */
async function triggerWeeklyReset(req, res) {
  try {
    const result = await rotateWeeklyStudentPasswordsNow({ sendNotifications: true });
    res.json({
      message: `Weekly reset triggered successfully: regenerated passwords for ${result.count || 0} student(s) with 1-week validity notice.`,
      ...result
    });
  } catch (error) {
    console.error('Trigger Weekly Reset Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Manual trigger for weekly reset early reminder notification (Admin only)
 */
async function triggerWeeklyResetNotice(req, res) {
  try {
    const result = await sendWeeklyResetEarlyNoticeToStudents();
    res.json({
      message: `Early reminder notice triggered successfully: sent to ${result.count || 0} student(s).`,
      ...result
    });
  } catch (error) {
    console.error('Trigger Weekly Reset Notice Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Create a new student (Registrar Admin / Staff)
 */
async function createStudent(req, res) {
  try {
    const { student_id, full_name, name, email, program, year_level, year, schedule, password } = req.body;
    const cleanId = (student_id || req.body.id || '').trim();
    const studentName = full_name || name;

    if (!cleanId || !studentName) {
      return res.status(400).json({ error: 'Student ID and Full Name are required.' });
    }

    const bcrypt = require('bcryptjs');
    const defaultPassword = password || 'DefaultPass123!';
    const password_hash = await bcrypt.hash(defaultPassword, 10);
    const now = new Date().toISOString();

    // 1. Upsert into students table
    const { data: newStudent, error: sErr } = await supabase
      .from('students')
      .upsert([{
        student_id: cleanId,
        full_name: studentName,
        program: program || 'BSIT',
        year_level: Number(year_level || year) || 1,
        verified: true,
        created_at: now
      }], { onConflict: 'student_id' })
      .select('*')
      .single();

    if (sErr) throw sErr;

    // 2. Upsert into accounts table
    const { error: aErr } = await supabase
      .from('accounts')
      .upsert([{
        student_id: cleanId,
        username: cleanId,
        password_hash,
        role: 'student',
        status: 'approved',
        created_at: now
      }], { onConflict: 'username' });

    if (aErr) console.warn('Account creation warning:', aErr.message);

    // 3. Sync profiles table
    if (email) {
      await supabase
        .from('profiles')
        .upsert([{
          id: `prof-${Date.now()}`,
          email,
          role: 'student',
          full_name: studentName,
          approval_status: 'approved',
          created_at: now
        }], { onConflict: 'email' });
    }

    res.status(201).json({
      message: `Student ${cleanId} created successfully in Supabase!`,
      student: newStudent
    });
  } catch (error) {
    console.error('Create Student Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Update existing student details in Supabase
 */
async function updateStudent(req, res) {
  try {
    const { id } = req.params;
    const { full_name, name, program, year_level, year, schedule, email } = req.body;
    const studentName = full_name || name;

    const reqStudentId = String(req.body.student_id || req.body.studentId || '').trim();
    const cleanId = String(id || '').trim();
    const strippedId = cleanId
      .replace(/^s-/i, '')
      .replace(/^student-/i, '')
      .replace(/^acc-/i, '')
      .replace(/^GCT-/i, '')
      .trim();
    const bareId = strippedId.replace(/^GCT-/i, '').trim();
    const withGct = `GCT-${bareId}`;
    const idVariants = Array.from(new Set([cleanId, strippedId, bareId, withGct, reqStudentId])).filter(Boolean);
    const orFilter = idVariants.map(v => `student_id.eq.${v},id.eq.${v}`).join(',');

    const updatePayload = {};
    if (studentName) updatePayload.full_name = studentName;
    if (program) updatePayload.program = program;
    if (year_level !== undefined || year !== undefined) {
      updatePayload.year_level = Number(year_level !== undefined ? year_level : year);
    }
    if (email) {
      updatePayload.email = email.trim();
    }

    let updated = null;

    // 1. Try finding student in `students` table first
    const { data: existingStudents } = await supabase
      .from('students')
      .select('*')
      .or(orFilter)
      .limit(1);

    let targetStudent = existingStudents?.[0] || null;

    if (!targetStudent && bareId) {
      const { data: byBare } = await supabase
        .from('students')
        .select('*')
        .eq('student_id', bareId)
        .limit(1);
      targetStudent = byBare?.[0] || null;
    }

    if (targetStudent) {
      const { data: uData, error: sErr } = await supabase
        .from('students')
        .update(updatePayload)
        .eq('id', targetStudent.id)
        .select('*');

      if (sErr) throw sErr;
      updated = uData?.[0] || null;
    } else if (bareId || reqStudentId) {
      // If student was not yet in students table, create/insert them with the specified year level!
      const newStudentPayload = {
        student_id: bareId || reqStudentId,
        full_name: studentName || 'Student',
        program: program || 'BSIT',
        year_level: Number(year_level !== undefined ? year_level : (year || 1)),
        verified: true,
        created_at: new Date().toISOString()
      };
      if (email) newStudentPayload.email = email.trim();

      const { data: insData, error: insErr } = await supabase
        .from('students')
        .insert([newStudentPayload])
        .select('*');

      if (!insErr && insData && insData.length > 0) {
        updated = insData[0];
      }
    }

    // 2. Also sync profiles table for backwards compatibility
    if (email || studentName) {
      const profUpdate = {};
      if (studentName) profUpdate.full_name = studentName;
      if (email) profUpdate.email = email.trim();
      const profOr = idVariants.map(v => `id.eq.${v},email.ilike.${v.toLowerCase()}@%`).join(',');
      await supabase
        .from('profiles')
        .update(profUpdate)
        .or(profOr);
    }

    res.json({
      message: `Student ${id} updated successfully in Supabase`,
      student: updated || null
    });
  } catch (error) {
    console.error('Update Student Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Delete student account from User Management.
 * CRITICAL: NEVER delete grade_records or academic_records!
 * Academic history and grades are permanent registrar records.
 */
async function deleteStudent(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Student ID is required for deletion.' });
    }

    const cleanId = String(id || '').trim();
    const strippedId = cleanId
      .replace(/^s-/i, '')
      .replace(/^student-/i, '')
      .replace(/^acc-/i, '')
      .replace(/^GCT-/i, '')
      .trim();
    const bareId = strippedId.replace(/^GCT-/i, '').trim();
    const withGct = `GCT-${bareId}`;
    const idVariants = Array.from(new Set([cleanId, strippedId, bareId, withGct, `student-${bareId}`, `student-${strippedId}`])).filter(Boolean);
    const orFilter = idVariants.map(v => `student_id.eq.${v},id.eq.${v}`).join(',');

    let studentId = bareId || cleanId;
    const { data: students } = await supabase
      .from('students')
      .select('student_id, email, id')
      .or(orFilter)
      .limit(1);

    let studentRow = students?.[0] || null;
    if (studentRow?.student_id) {
      studentId = studentRow.student_id;
    }

    // 1. Delete LOGIN account from accounts table
    const accOr = idVariants.map(v => `student_id.eq.${v},username.eq.${v},id.eq.${v}`).join(',');
    await supabase.from('accounts').delete().or(accOr);

    // 2. Delete LOGIN profile from profiles table
    const profFilters = idVariants.map(v => `id.eq.${v},email.ilike.${v.toLowerCase()}@%`);
    if (studentRow?.email) profFilters.push(`email.eq.${studentRow.email}`);
    if (studentRow?.id) profFilters.push(`id.eq.${studentRow.id}`);
    await supabase.from('profiles').delete().or(profFilters.join(','));

    // 3. Delete student recommendations
    try {
      await supabase
        .from('recommendations')
        .delete()
        .or(idVariants.map(v => `student_id.eq.${v}`).join(','));
    } catch (rErr) {
      console.warn('Recommendations clean notice on student delete:', rErr.message);
    }

    // If account_only=true (invoked from User Management to revoke login credentials),
    // preserve the student profile and academic grades:
    const accountOnly = req.query.account_only === 'true' || req.query.mode === 'account';

    if (accountOnly) {
      await supabase
        .from('students')
        .update({
          verified: false,
          status: 'unregistered'
        })
        .or(orFilter);

      return res.json({
        message: `User account for '${studentId}' deleted successfully. Academic records and student profile remain preserved.`,
        studentId,
        accountOnly: true
      });
    }

    // Full student deletion (invoked from Student Academic Records or Student Records):
    // Permanently purge all matching academic records and grade records
    await supabase
      .from('academic_records')
      .delete()
      .or(idVariants.map(v => `student_id.eq.${v}`).join(','));

    await supabase
      .from('grade_records')
      .delete()
      .or(idVariants.map(v => `student_id.eq.${v}`).join(','));

    // Permanently delete the student row from students table
    const { error: delErr } = await supabase
      .from('students')
      .delete()
      .or(orFilter);

    if (delErr) {
      console.error('Delete Student DB Error:', delErr);
      throw delErr;
    }

    // Invalidate cached summaries
    global._cachedStudentSummaries = null;
    global._cachedStudentSummariesTime = 0;

    res.json({
      success: true,
      message: `Student '${studentId}' and all associated academic records deleted successfully from database.`,
      studentId,
      fullDelete: true
    });
  } catch (error) {
    console.error('Delete Student Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Serve local verification photo (Registrar authentication required)
 */
async function serveLocalPhoto(req, res) {
  try {
    const { folder, filename } = req.params;
    if (folder.includes('..') || filename.includes('..')) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    const filePath = path.join(LOCAL_UPLOAD_DIR, folder, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('Serve Photo Error:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getAllStudents,
  getPendingVerifications,
  getStudentById,
  updateStudentApproval,
  createStudent,
  updateStudent,
  deleteStudent,
  serveLocalPhoto,
  triggerWeeklyReset,
  triggerWeeklyResetNotice
};
