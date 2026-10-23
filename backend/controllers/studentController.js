const path = require('path');
const fs = require('fs');
const { supabase } = require('../config/supabase');
const { getSignedPhotoUrl, LOCAL_UPLOAD_DIR } = require('../services/storageService');

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

    // Dynamic standing year level calculation based on actual grade data (auto-advance & auto-revert)
    const studentStandingYears = new Map();
    try {
      const { data: grRows } = await supabase
        .from('grade_records')
        .select('student_id, year_level, semester')
        .limit(50000);

      const studentGradesMap = new Map();
      (grRows || []).forEach(g => {
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

        grades.forEach(g => {
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

        let calculatedYear = maxYear;
        // Year 1 -> 2: completing 2nd sem of Year 1
        if ((sem2Counts.get(1) || 0) >= 3) {
          calculatedYear = Math.max(calculatedYear, 2);
        }
        // Year 2 -> 3: completing 2nd sem of Year 2
        if ((sem2Counts.get(2) || 0) >= 3) {
          calculatedYear = Math.max(calculatedYear, 3);
        }
        // Year 3 -> 4: requires completing 3rd Year Summer OR taking Year 4 subjects (maxYear >= 4).
        // Completing 3rd Year 2nd Sem keeps the student in 3rd Year because Summer is still required!
        if (hasSummerYear3 || maxYear >= 4) {
          calculatedYear = Math.max(calculatedYear, 4);
        }
        calculatedYear = Math.min(4, Math.max(1, calculatedYear));
        studentStandingYears.set(sid, calculatedYear);
      });
    } catch (yrErr) {
      console.warn('Failed to pre-compute student standing years:', yrErr);
    }

    const students = await Promise.all((studentsData || []).map(async r => {
      const idFrontUrl = await getSignedPhotoUrl(r.id_front_path || r.id_front_image);
      const idBackUrl = await getSignedPhotoUrl(r.id_back_path || r.id_back_image);
      const selfieUrl = await getSignedPhotoUrl(r.selfie_path || r.selfie_image);

      const acct = accountsMap.get(r.student_id);
      const prof = (acct?.id ? profilesMap.get(acct.id) : null) || profilesMap.get(r.student_id?.toLowerCase());
      const approvalStatus = acct?.status || (r.verified ? 'approved' : 'pending');
      const realEmail = r.email || prof?.email || `${r.student_id.toLowerCase()}@student.gct.edu.ph`;
      const realCreatedAt = acct?.created_at || r.created_at || prof?.created_at || new Date().toISOString();

      const hasAccount = Boolean(acct);
      const defCount = activeDeficiencyCounts.get(r.student_id) || 0;
      const cleanSId = String(r.student_id).replace(/^GCT-/i, '');
      const hasGrades = studentStandingYears.has(r.student_id) || studentStandingYears.has(cleanSId);
      const effectiveYearLevel = hasGrades
        ? (studentStandingYears.get(r.student_id) || studentStandingYears.get(cleanSId))
        : Number(r.year_level || 1);

      // Keep database students.year_level synchronized if actual data dictates a reverted/advanced year
      if (hasGrades && Number(r.year_level) !== effectiveYearLevel) {
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
        schedule: r.schedule || r.section || 'Block A',
        section: r.schedule || r.section || 'Block A',
        verified: Boolean(r.verified),
        status: hasAccount ? approvalStatus : 'unregistered',
        has_account: hasAccount,
        has_deficiencies: defCount > 0,
        hasDeficiencies: defCount > 0,
        deficiency_count: defCount,
        deficiencyCount: defCount,
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
    }));

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

    const pending = await Promise.all(pendingRows.map(async r => {
      const acct = accountsMap.get(r.student_id);
      return {
        student_id: r.student_id,
        full_name: r.full_name,
        program: r.program,
        year_level: r.year_level,
        schedule: r.schedule || 'Block A',
        verified: Boolean(r.verified),
        account_status: acct?.status || 'pending',
        created_at: r.created_at,
        id_front_url: await getSignedPhotoUrl(r.id_front_path),
        id_back_url: await getSignedPhotoUrl(r.id_back_path),
        selfie_url: await getSignedPhotoUrl(r.selfie_path)
      };
    }));

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

    const idFrontUrl = await getSignedPhotoUrl(row.id_front_path);
    const idBackUrl = await getSignedPhotoUrl(row.id_back_path);
    const selfieUrl = await getSignedPhotoUrl(row.selfie_path);

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
      schedule: row.schedule || row.section || 'Block A',
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
      .update({ verified: isVerified })
      .or(`student_id.eq.${studentId},id.eq.${studentId}`);

    // 3. Update or create accounts table row
    const { data: existingAccounts } = await supabase
      .from('accounts')
      .select('*')
      .or(`student_id.eq.${studentId},username.eq.${studentId}`)
      .limit(1);

    if (existingAccounts && existingAccounts.length > 0) {
      await supabase
        .from('accounts')
        .update({ status: approval_status })
        .or(`student_id.eq.${studentId},username.eq.${studentId}`);
    } else if (approval_status === 'approved') {
      // Upsert missing account row in Supabase so the approved student can log in
      const bcrypt = require('bcryptjs');
      const defaultPassHash = await bcrypt.hash('DefaultPass123!', 10);
      await supabase
        .from('accounts')
        .insert([{
          id: `acc-${Date.now()}`,
          student_id: studentId,
          username: studentId,
          password_hash: defaultPassHash,
          role: 'student',
          status: 'approved',
          created_at: new Date().toISOString()
        }]);
    }

    // Sync profiles table for backwards compatibility
    const profileFilters = [`id.eq.${id}`, `email.ilike.${studentId.toLowerCase()}%`];
    if (studentRow?.email) profileFilters.push(`email.eq.${studentRow.email}`);
    await supabase
      .from('profiles')
      .update({ approval_status })
      .or(profileFilters.join(','));

    res.json({
      message: `Student ${studentId} verification successfully set to '${approval_status}'`,
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
        schedule: schedule || 'Block A',
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
    if (schedule) {
      updatePayload.schedule = schedule;
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
        schedule: schedule || 'Schedule 1',
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
    const idVariants = Array.from(new Set([cleanId, strippedId, bareId, withGct])).filter(Boolean);
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

    // 3. Check if student has permanent grades in grade_records or academic_records
    let hasGrades = false;
    try {
      const { data: grades } = await supabase
        .from('grade_records')
        .select('id')
        .or(idVariants.map(v => `student_id.eq.${v}`).join(','))
        .limit(1);
      if (grades && grades.length > 0) hasGrades = true;

      if (!hasGrades) {
        const { data: acads } = await supabase
          .from('academic_records')
          .select('id')
          .or(idVariants.map(v => `student_id.eq.${v}`).join(','))
          .limit(1);
        if (acads && acads.length > 0) hasGrades = true;
      }
    } catch (gErr) {
      console.warn('Grade check error on student delete:', gErr);
    }

    if (hasGrades) {
      // Keep student row for registrar historical grades, but deactivate account & clear registration photos
      await supabase
        .from('students')
        .update({
          verified: false,
          id_front_path: null,
          id_back_path: null,
          selfie_path: null,
          id_front_image: null,
          id_back_image: null,
          selfie_image: null
        })
        .or(orFilter);
    } else {
      // No grade records: completely remove student record from Supabase
      await supabase
        .from('students')
        .delete()
        .or(orFilter);
    }

    res.json({
      message: `Student account for '${studentId}' deleted successfully from Supabase.`,
      studentId
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
  serveLocalPhoto
};
