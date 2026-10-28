const { supabase } = require('../config/supabase');
const { getPassingThreshold } = require('./settingsController');
const { normalizeSubjCode } = require('../services/assessmentEngine');

// In-memory cache for static subjects catalog (reduces 1+ second DB query overhead per request)
let cachedSubjectsData = null;
let cachedSubjectsTime = 0;
const SUBJECTS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedSubjects() {
  const now = Date.now();
  if (cachedSubjectsData && (now - cachedSubjectsTime < SUBJECTS_CACHE_TTL)) {
    return cachedSubjectsData;
  }
  const { data: subjectsData } = await supabase.from('subjects').select('*');
  cachedSubjectsData = subjectsData || [];
  cachedSubjectsTime = now;
  return cachedSubjectsData;
}

async function getAcademicRecords(req, res) {
  try {
    const { student_id, academic_year } = req.query;
    let targetStudentId = student_id;
    const filterAy = academic_year && academic_year !== 'all' ? String(academic_year).trim() : null;

    if (req.user?.role === 'student') {
      const sId = req.user.student_id || req.user.username || req.user.id || '';
      const cleanId = String(sId).replace(/^acc-/i, '').replace(/^student-/i, '').replace(/^GCT-/i, '').trim();
      targetStudentId = targetStudentId || cleanId || sId;
    }

    // Build ID variants for flexible lookup (e.g., 10526 and GCT-10526)
    let idVariants = [];
    if (targetStudentId && typeof targetStudentId === 'string') {
      const clean = targetStudentId.replace(/^acc-/i, '').replace(/^student-/i, '').replace(/^GCT-/i, '').trim();
      const withGct = targetStudentId.startsWith('GCT-') ? targetStudentId : `GCT-${clean}`;
      idVariants = Array.from(new Set([targetStudentId.trim(), clean, withGct])).filter(Boolean);
    }

    // 1. Fetch subjects table to build code/id lookup (from fast memory cache)
    const subjectsData = await getCachedSubjects();
    const subjectsMap = new Map();
    const codeMap = new Map();
    (subjectsData || []).forEach(s => {
      subjectsMap.set(s.id, s);
      if (s.code) {
        codeMap.set(s.code.toLowerCase().trim(), s);
        const norm = normalizeSubjCode(s.code);
        codeMap.set(norm, s);
      }
      if (s.title) {
        codeMap.set(s.title.toLowerCase().trim(), s);
        const titleNorm = normalizeSubjCode(s.title);
        codeMap.set(titleNorm, s);
      }
    });

    // 2. Query academic_records
    let recordsQuery = supabase
      .from('academic_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (idVariants.length > 0) {
      recordsQuery = recordsQuery.in('student_id', idVariants);
    }
    if (filterAy) {
      recordsQuery = recordsQuery.ilike('term', `${filterAy}%`);
    }

    const { data: rows, error: recErr } = await recordsQuery;
    if (recErr) throw recErr;

    // 3. Query grade_records (with full pagination when fetching multi-student datasets)
    let gRows = [];
    if (idVariants.length > 0) {
      // Single student lookup - small payload (< 100 rows)
      let singleQuery = supabase
        .from('grade_records')
        .select('*')
        .in('student_id', idVariants)
        .order('academic_year', { ascending: true })
        .order('semester', { ascending: true });
      if (filterAy) singleQuery = singleQuery.eq('academic_year', filterAy);
      const { data, error } = await singleQuery;
      if (error) throw error;
      gRows = data || [];
    } else {
      // Multi-student / All students lookup - paginate through Supabase 1000-row limit
      let from = 0;
      const pageSize = 1000;
      while (true) {
        let pQuery = supabase
          .from('grade_records')
          .select('*')
          .order('id', { ascending: true })
          .range(from, from + pageSize - 1);
        if (filterAy) pQuery = pQuery.eq('academic_year', filterAy);
        const { data, error } = await pQuery;
        if (error) throw error;
        if (!data || data.length === 0) break;
        gRows.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
    }

    // 4. Merge results: academic_records take precedence over grade_records
    const mergedMap = new Map();

    // First process grade_records
    (gRows || []).forEach(g => {
      const subjRaw = (g.subject || '').trim();
      const subjClean = subjRaw.replace(/\s+/g, ' ');
      const subNorm = normalizeSubjCode(subjClean);
      const matchedSub = codeMap.get(subjClean.toLowerCase()) || codeMap.get(subNorm) || null;

      const semFormatted = (g.semester === 'Second' || g.semester === '2' || String(g.semester).toLowerCase().includes('2nd')) ? '2nd Sem' : '1st Sem';
      const semNumeric = (g.semester === 'Second' || g.semester === '2' || String(g.semester).toLowerCase().includes('2nd')) ? 2 : 1;
      const termFormatted = `${g.academic_year || '2023-2024'} ${semFormatted}`;

      const rawGradeStr = String(g.raw_grade || '').trim();
      const isDropped = rawGradeStr === '9' || g.grade === 9 || rawGradeStr.toUpperCase() === 'DRP' || (g.needs_review && rawGradeStr === '9');
      const isFailed = rawGradeStr === '5' || g.grade === 5 || (g.grade !== null && Number(g.grade) > 3.0 && !isDropped);

      let status = 'passed';
      let cleanGrade = null;

      if (isDropped) {
        status = 'dropped';
        cleanGrade = null;
      } else if (isFailed) {
        status = 'failed';
        cleanGrade = 5.0;
      } else if (g.grade !== null && g.grade !== undefined && g.grade !== '') {
        const num = Number(g.grade);
        if (!isNaN(num)) {
          cleanGrade = num;
          status = num <= 3.0 ? 'passed' : 'failed';
        }
      }

      const recordKey = `${g.student_id}-${subNorm}-${termFormatted}`;
      const newEntry = {
        id: `gr-${g.id}`,
        student_id: g.student_id,
        studentName: g.full_name || `${g.first_name || ''} ${g.last_name || ''}`.trim(),
        subject_id: matchedSub?.id || subjClean,
        grade: cleanGrade,
        raw_grade: g.raw_grade,
        is_dropped: isDropped,
        term: termFormatted,
        academic_year: g.academic_year,
        semester: semNumeric,
        status,
        created_at: g.created_at || new Date().toISOString(),
        subject: {
          id: matchedSub?.id || subjClean,
          code: matchedSub?.code || subjClean,
          title: matchedSub?.title || subjClean,
          units: matchedSub?.units || Number(g.units || 3),
          program: matchedSub?.program || g.course || 'BSIT',
          year_level: matchedSub?.year_level || Number(g.year_level) || 1,
          semester: semNumeric
        }
      };

      if (mergedMap.has(recordKey)) {
        const existing = mergedMap.get(recordKey);
        const existDrop = existing.is_dropped;
        const existPass = !existDrop && existing.grade !== null && existing.grade <= 3.0;
        const newPass = !isDropped && cleanGrade !== null && cleanGrade <= 3.0;

        if (newPass && !existPass) {
          mergedMap.set(recordKey, newEntry);
        } else if (!existPass && !newPass && !isDropped && existDrop) {
          mergedMap.set(recordKey, newEntry);
        } else if (g.id > parseInt(String(existing.id).replace(/\D/g, '') || '0', 10)) {
          // If statuses are equal, keep newer record
          mergedMap.set(recordKey, newEntry);
        }
      } else {
        mergedMap.set(recordKey, newEntry);
      }
    });

    // 4b. Filter out orphaned academic_records that were deleted in grade_records
    // If student has existing records in grade_records, verify academic_records row is not a ghost/orphan
    let validRows = rows || [];
    if (gRows && gRows.length > 0) {
      const grSubjsByStudent = new Map();
      gRows.forEach(g => {
        const sid = String(g.student_id).trim();
        if (!grSubjsByStudent.has(sid)) grSubjsByStudent.set(sid, new Set());
        grSubjsByStudent.get(sid).add(normalizeSubjCode(g.subject));
      });

      const orphanAcIds = [];
      validRows = (rows || []).filter(r => {
        const sid = String(r.student_id).trim();
        if (grSubjsByStudent.has(sid)) {
          const rNorm = normalizeSubjCode(r.subject_id);
          const existsInGr = grSubjsByStudent.get(sid).has(rNorm);
          if (!existsInGr) {
            orphanAcIds.push(r.id);
            return false; // Exclude deleted record from API response
          }
        }
        return true;
      });

      if (orphanAcIds.length > 0) {
        supabase.from('academic_records').delete().in('id', orphanAcIds).then(() => {}).catch(() => {});
      }
    }

    // Then overlay valid academic_records
    validRows.forEach(r => {
      const sub = subjectsMap.get(r.subject_id) || codeMap.get((r.subject_id || '').toLowerCase().trim());
      const subNorm = (sub?.code || r.subject_id || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const termFormatted = r.term || '2024-2025 1st Sem';
      const recordKey = `${r.student_id}-${subNorm}-${termFormatted}`;

      mergedMap.set(recordKey, {
        id: r.id,
        student_id: r.student_id,
        studentName: r.studentName || 'Student',
        subject_id: r.subject_id,
        grade: r.grade !== null ? Number(r.grade) : null,
        term: termFormatted,
        status: r.status,
        created_at: r.created_at,
        subject: sub ? {
          id: sub.id,
          code: sub.code,
          title: sub.title,
          units: sub.units,
          program: sub.program,
          year_level: sub.year_level,
          semester: sub.semester
        } : {
          id: r.subject_id,
          code: r.subject_id,
          title: r.subject_id,
          units: 3,
          program: 'BSIT',
          year_level: 1,
          semester: 1
        }
      });
    });

    const records = Array.from(mergedMap.values());

    const filterAY = String(req.query.academic_year || '').trim();
    let finalRecords = records;
    if (filterAY) {
      finalRecords = records.filter(r => {
        const rAY = String(r.academic_year || '').trim();
        return rAY.toLowerCase() === filterAY.toLowerCase();
      });
    }

    res.json(finalRecords);
  } catch (error) {
    console.error('Get Academic Records Error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function syncStudentYearLevel(studentId) {
  try {
    if (!studentId) return;
    const cleanId = String(studentId).replace(/^GCT-/i, '').trim();
    const idVariants = [String(studentId).trim(), cleanId, `GCT-${cleanId}`];

    // Fetch all current grade records for this student
    const { data: gr } = await supabase
      .from('grade_records')
      .select('year_level, semester')
      .in('student_id', idVariants);

    if (!gr || gr.length === 0) return;

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

    // Update students table in Supabase so it accurately advances or reverts based on data
    await supabase
      .from('students')
      .update({ year_level: calculatedYear })
      .in('student_id', idVariants);

    return calculatedYear;
  } catch (e) {
    console.warn('Sync student year level notice:', e);
  }
}

async function createOrUpdateRecord(req, res) {
  try {
    const { student_id, subject_id, grade, term, record_id, units } = req.body;
    if (!student_id || !subject_id || grade === undefined || !term) {
      return res.status(400).json({ error: 'student_id, subject_id, grade, and term are required' });
    }

    const numericGrade = Number(grade);
    const computedStatus = (numericGrade <= 3.0 || numericGrade >= 75) ? 'passed' : 'failed';
    const now = new Date().toISOString();

    const ayMatch = String(term).match(/\d{4}-\d{4}/);
    const academicYear = ayMatch ? ayMatch[0] : (req.body.academic_year || '2025-2026');
    const isSem2 = /2nd|second/i.test(term);
    const isSummer = /summer/i.test(term);
    const semStr = isSummer ? 'Summer' : (isSem2 ? 'Second' : 'First');
    const rawGradeStr = String(numericGrade);
    const cleanSub = String(subject_id).trim();
    const cleanSubNoDoubleSpaces = cleanSub.replace(/\s+/g, ' ');
    const normSub = cleanSub.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    // 1. UPDATE OR INSERT INTO `grade_records` (PRIMARY Supabase Table)
    let updatedGradeRecord = null;
    let grNumericId = null;

    if (record_id && typeof record_id === 'string' && record_id.startsWith('gr-')) {
      grNumericId = parseInt(record_id.replace(/^gr-/i, ''), 10);
    } else if (typeof record_id === 'number') {
      grNumericId = record_id;
    }

    if (Number.isFinite(grNumericId) && grNumericId > 0) {
      // Direct update by ID in grade_records
      const { data: grData, error: grErr } = await supabase
        .from('grade_records')
        .update({
          grade: numericGrade,
          raw_grade: rawGradeStr,
          units: units ? Number(units) : undefined,
          needs_review: false
        })
        .eq('id', grNumericId)
        .select();

      if (!grErr && grData && grData.length > 0) {
        updatedGradeRecord = grData[0];
      }
    }

    // If not updated by explicit ID, find existing row in grade_records by student_id & subject
    if (!updatedGradeRecord) {
      const { data: existingGrades } = await supabase
        .from('grade_records')
        .select('*')
        .eq('student_id', String(student_id).trim());

      const match = (existingGrades || []).find(r => {
        const rNorm = normalizeSubjCode(r.subject);
        if (rNorm !== normalizeSubjCode(cleanSub)) return false;
        if (r.academic_year && academicYear && r.academic_year !== academicYear) return false;
        return true;
      });

      if (match) {
        const { data: grData, error: grErr } = await supabase
          .from('grade_records')
          .update({
            grade: numericGrade,
            raw_grade: rawGradeStr,
            units: units ? Number(units) : undefined,
            needs_review: false
          })
          .eq('id', match.id)
          .select();

        if (!grErr && grData && grData.length > 0) {
          updatedGradeRecord = grData[0];
        }
      } else {
        // If no existing row exists in grade_records, insert a new row in grade_records
        const { data: studentData } = await supabase
          .from('students')
          .select('*')
          .eq('student_id', String(student_id).trim())
          .limit(1);

        const st = studentData?.[0];
        const newGrPayload = {
          student_id: String(student_id).trim(),
          full_name: st?.name || req.body.studentName || 'Student',
          last_name: st?.last_name || (st?.name ? st.name.split(',')[0].trim() : ''),
          first_name: st?.first_name || (st?.name ? st.name.split(',')[1]?.trim() || '' : ''),
          course: st?.program || req.body.course || 'BSIT',
          year_level: st?.year || req.body.yearLevel || 1,
          semester: semStr,
          academic_year: academicYear,
          subject: cleanSubNoDoubleSpaces,
          grade: numericGrade,
          raw_grade: rawGradeStr,
          units: units ? Number(units) : 3,
          created_at: now,
          needs_review: false
        };

        const { data: insertedGr, error: insErr } = await supabase
          .from('grade_records')
          .insert([newGrPayload])
          .select();

        if (!insErr && insertedGr && insertedGr.length > 0) {
          updatedGradeRecord = insertedGr[0];
        }
      }
    }

    // 2. ALSO UPSERT INTO `academic_records` (for complete parity across Supabase tables)
    const recordPayload = {
      student_id: String(student_id).trim(),
      subject_id: cleanSubNoDoubleSpaces,
      grade: numericGrade,
      term,
      status: computedStatus,
      created_at: now
    };

    const { data: upserted, error: upErr } = await supabase
      .from('academic_records')
      .upsert([recordPayload], { onConflict: 'student_id,subject_id,term' });

    if (upErr) console.warn('Academic records upsert notice:', upErr.message);

    const { data: subData } = await supabase
      .from('subjects')
      .select('*')
      .eq('code', cleanSubNoDoubleSpaces)
      .limit(1);

    // 3. Keep student's year_level in `students` table synchronized based on their actual grade data (auto-advance & auto-revert)
    const accurateYearLevel = await syncStudentYearLevel(student_id);

    const record = {
      id: updatedGradeRecord ? `gr-${updatedGradeRecord.id}` : (upserted?.[0]?.id || `rec-${Date.now()}`),
      ...recordPayload,
      subject: subData?.[0] || {
        id: cleanSubNoDoubleSpaces,
        code: cleanSubNoDoubleSpaces,
        title: req.body.title || cleanSubNoDoubleSpaces,
        units: units || 3
      }
    };

    res.json(record);
  } catch (error) {
    console.error('Create/Update Record Error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function batchUpdateRecords(req, res) {
  try {
    const rawRecords = req.body.records || req.body;
    if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
      return res.status(400).json({ error: 'Records array is required' });
    }

    const now = new Date().toISOString();
    const studentsMap = new Map();
    const academicRecordsPayload = [];
    const gradeRecordsPayload = [];
    const affectedStudentIds = new Set();

    // 1. Fetch subjects from DB for normalization & code resolution
    const { data: dbSubjects } = await supabase.from('subjects').select('*');
    const subMap = new Map();
    (dbSubjects || []).forEach(s => {
      if (s.code) subMap.set(normalizeSubjCode(s.code), s);
      if (s.title) subMap.set(normalizeSubjCode(s.title), s);
    });

    for (const r of rawRecords) {
      const rawSid = String(r.student_id || r.studentId || r.studentNo || r.id || '').trim();
      const cleanSid = rawSid.replace(/^GCT-/i, '').trim();
      if (!cleanSid) continue;

      const rawSub = String(r.subject_id || r.subject || r.code || r.subjectCode || '').trim();
      if (!rawSub) continue;

      affectedStudentIds.add(cleanSid);

      // Student metadata
      let studentName = String(r.studentName || r.name || r.full_name || r.fullName || r.student_name || '').trim();
      if (!studentName) {
        const ln = String(r.last_name || r.lastName || '').trim();
        const fn = String(r.first_name || r.firstName || '').trim();
        if (ln && fn) studentName = `${ln}, ${fn}`;
        else if (ln || fn) studentName = ln || fn;
      }
      const course = String(r.course || r.program || 'BSIT').trim();
      const yearLevel = Number(r.year_level || r.year || r.yearLevel || 1);

      if (!studentsMap.has(cleanSid) && (studentName || course)) {
        studentsMap.set(cleanSid, {
          student_id: cleanSid,
          full_name: studentName || 'Student ' + cleanSid,
          program: course || 'BSIT',
          year_level: yearLevel || 1
        });
      }

      // Subject normalization
      const norm = normalizeSubjCode(rawSub);
      const matchedDbSub = subMap.get(norm);
      const cleanSub = matchedDbSub ? matchedDbSub.code : rawSub.replace(/\s+/g, ' ');
      const subUnits = Number(r.units || matchedDbSub?.units || 3);
      const subYear = Number(r.year_level || r.year || matchedDbSub?.year_level || yearLevel || 1);

      // Grade parsing
      const rawGrade = r.raw_grade || r.rawGrade || (r.grade !== undefined && r.grade !== null ? String(r.grade) : '');
      const isDropped = Boolean(
        r.is_dropped || r.isDropped ||
        String(rawGrade) === '9' ||
        String(r.grade) === '9' ||
        /drop|drp/i.test(String(rawGrade)) ||
        String(r.status) === 'dropped'
      );

      let numGrade = null;
      if (!isDropped && rawGrade !== '' && rawGrade !== null && rawGrade !== undefined) {
        const parsed = Number(rawGrade);
        if (!isNaN(parsed)) numGrade = parsed;
      }
      if (numGrade === null && r.grade !== undefined && r.grade !== null && r.grade !== '') {
        const parsed = Number(r.grade);
        if (!isNaN(parsed)) numGrade = parsed;
      }

      // Status
      let status = 'passed';
      if (isDropped) {
        status = 'dropped';
      } else if (numGrade === null) {
        status = 'pending';
      } else if (numGrade <= 3.0 || numGrade >= 75) {
        status = 'passed';
      } else {
        status = 'failed';
      }

      // Term & Semester & AY
      const termRaw = String(r.term || r.academicTerm || '').trim();
      const ayMatch = termRaw.match(/\d{4}-\d{4}/);
      const academicYear = ayMatch ? ayMatch[0] : String(r.academic_year || r.academicYear || '2027-2028').trim();
      const isSem2 = /2nd|second/i.test(termRaw) || String(r.semester) === '2' || String(r.semester).toLowerCase().includes('second');
      const isSummer = /summer/i.test(termRaw) || String(r.semester) === '3' || String(r.semester).toLowerCase().includes('summer');
      const semStr = isSummer ? 'Summer' : (isSem2 ? 'Second' : 'First');
      const termFormatted = termRaw && ayMatch ? termRaw : `${academicYear} ${isSummer ? 'Summer' : (isSem2 ? '2nd Sem' : '1st Sem')}`;

      // Payload for academic_records
      academicRecordsPayload.push({
        id: `rec-imp-${cleanSid}-${norm}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        student_id: cleanSid,
        subject_id: cleanSub,
        grade: (numGrade !== null && !isNaN(numGrade)) ? numGrade : (isDropped ? 5.0 : 0.0),
        term: termFormatted,
        status,
        created_at: now
      });

      // Payload for grade_records
      const lastName = studentName.includes(',') ? studentName.split(',')[0].trim() : studentName.split(' ')[0] || cleanSid;
      const firstName = studentName.includes(',') ? studentName.split(',')[1].trim() : studentName.split(' ').slice(1).join(' ') || '';

      gradeRecordsPayload.push({
        student_id: cleanSid,
        full_name: studentName || 'Student ' + cleanSid,
        last_name: lastName,
        first_name: firstName,
        course,
        year_level: subYear,
        semester: semStr,
        academic_year: academicYear,
        subject: cleanSub,
        grade: isDropped ? null : numGrade,
        raw_grade: String(rawGrade || (numGrade !== null ? numGrade : '')),
        units: subUnits,
        needs_review: false,
        created_at: now
      });
    }

    // 2. Ensure students exist in `students` table
    for (const [sid, stData] of studentsMap.entries()) {
      const { data: exists } = await supabase.from('students').select('id, full_name, program, year_level').eq('student_id', sid).limit(1);
      if (!exists || exists.length === 0) {
        await supabase.from('students').insert([{
          id: `student-${sid}`,
          student_id: sid,
          full_name: stData.full_name,
          program: stData.program,
          year_level: stData.year_level || 1,
          status: 'approved',
          verified: true,
          created_at: now
        }]);
      } else {
        const existingName = exists[0].full_name || '';
        const isPlaceholder = !existingName || /^student\s+\d+$/i.test(existingName) || existingName.toLowerCase() === 'student';
        const hasRealName = stData.full_name && !/^student\s+\d+$/i.test(stData.full_name);
        
        const updateFields = {
          program: stData.program || exists[0].program || 'BSIT',
          year_level: stData.year_level || exists[0].year_level || 1,
          status: 'approved',
          verified: true
        };
        if (hasRealName && isPlaceholder) {
          updateFields.full_name = stData.full_name;
        }
        await supabase.from('students').update(updateFields).eq('id', exists[0].id);
      }
    }

    // 3. Batch upsert into academic_records
    if (academicRecordsPayload.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < academicRecordsPayload.length; i += chunkSize) {
        const chunk = academicRecordsPayload.slice(i, i + chunkSize);
        const { error: arErr } = await supabase
          .from('academic_records')
          .upsert(chunk, { onConflict: 'student_id,subject_id,term' });
        if (arErr) console.warn('academic_records batch upsert notice:', arErr.message);
      }
    }

    // 4. Batch update / insert into grade_records
    if (gradeRecordsPayload.length > 0) {
      const sidList = Array.from(new Set(gradeRecordsPayload.map(g => g.student_id)));
      const { data: existingGrs } = await supabase
        .from('grade_records')
        .select('id, student_id, subject, academic_year, semester')
        .in('student_id', sidList);

      const existingMap = new Map();
      (existingGrs || []).forEach(g => {
        const key = `${String(g.student_id).trim()}-${normalizeSubjCode(g.subject)}-${g.academic_year}`;
        existingMap.set(key, g.id);
      });

      const toInsert = [];
      for (const gr of gradeRecordsPayload) {
        const key = `${String(gr.student_id).trim()}-${normalizeSubjCode(gr.subject)}-${gr.academic_year}`;
        if (existingMap.has(key)) {
          const rowId = existingMap.get(key);
          await supabase.from('grade_records').update({
            grade: gr.grade,
            raw_grade: gr.raw_grade,
            units: gr.units,
            semester: gr.semester,
            needs_review: false
          }).eq('id', rowId);
        } else {
          toInsert.push(gr);
        }
      }

      if (toInsert.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < toInsert.length; i += chunkSize) {
          const chunk = toInsert.slice(i, i + chunkSize);
          const { error: insErr } = await supabase.from('grade_records').insert(chunk);
          if (insErr) console.warn('grade_records batch insert notice:', insErr.message);
        }
      }
    }

    // 5. Sync student year levels
    for (const sid of affectedStudentIds) {
      await syncStudentYearLevel(sid);
    }

    res.json({
      success: true,
      message: `Successfully stored ${academicRecordsPayload.length} grade records into the database!`,
      count: academicRecordsPayload.length,
      affectedStudents: Array.from(affectedStudentIds)
    });
  } catch (error) {
    console.error('Batch Update Records Error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function deleteRecord(req, res) {
  try {
    const recordId = req.params.id || req.body.record_id || req.body.id || req.query.id;
    const studentId = req.query.student_id || req.body.student_id;
    const subjectId = req.query.code || req.query.subject_id || req.query.subject || req.body.code || req.body.subject_id;
    const term = req.query.term || req.body.term;
    const deleteAllForStudent = req.query.all === 'true' || req.params.id === 'all' || req.query.action === 'all';

    let targetStudentId = studentId ? String(studentId).trim() : null;
    let targetSubject = subjectId ? String(subjectId).trim() : null;
    let targetTerm = term ? String(term).trim() : null;

    let deletedFromAcademicRecords = 0;
    let deletedFromGradeRecords = 0;

    // Handle bulk delete of all records for a student
    if (targetStudentId && deleteAllForStudent) {
      const cleanSid = targetStudentId.replace(/^GCT-/i, '').trim();
      const sIds = [targetStudentId, cleanSid, `GCT-${cleanSid}`];
      
      const { data: acDels } = await supabase
        .from('academic_records')
        .delete()
        .in('student_id', sIds)
        .select();
      if (acDels) deletedFromAcademicRecords = acDels.length;

      const { data: grDels } = await supabase
        .from('grade_records')
        .delete()
        .in('student_id', sIds)
        .select();
      if (grDels) deletedFromGradeRecords = grDels.length;

      const updatedYearLevel = await syncStudentYearLevel(targetStudentId);
      return res.json({
        success: true,
        message: `All academic records for student '${targetStudentId}' deleted successfully.`,
        deletedFromAcademicRecords,
        deletedFromGradeRecords,
        year_level: updatedYearLevel
      });
    }

    // 1. If explicit record ID provided
    if (recordId && recordId !== 'all') {
      const idStr = String(recordId).trim();
      if (idStr.startsWith('gr-') || /^\d+$/.test(idStr)) {
        const numId = parseInt(idStr.replace(/^gr-/i, ''), 10);
        if (Number.isFinite(numId)) {
          const { data: grData } = await supabase
            .from('grade_records')
            .select('student_id, subject, academic_year, semester')
            .eq('id', numId)
            .limit(1);

          if (grData && grData.length > 0) {
            targetStudentId = targetStudentId || grData[0].student_id;
            targetSubject = targetSubject || grData[0].subject;
          }

          const { error: dErr } = await supabase
            .from('grade_records')
            .delete()
            .eq('id', numId);
          if (!dErr) deletedFromGradeRecords++;
        }
      } else {
        const { data: acData } = await supabase
          .from('academic_records')
          .select('student_id, subject_id, term')
          .eq('id', idStr)
          .limit(1);

        if (acData && acData.length > 0) {
          targetStudentId = targetStudentId || acData[0].student_id;
          targetSubject = targetSubject || acData[0].subject_id;
          targetTerm = targetTerm || acData[0].term;
        }

        const { error: dErr } = await supabase
          .from('academic_records')
          .delete()
          .eq('id', idStr);
        if (!dErr) deletedFromAcademicRecords++;
      }
    }

    // 2. Cross-delete from both tables using resolved student_id and subject aliases
    if (targetStudentId && targetSubject) {
      const cleanSid = targetStudentId.replace(/^GCT-/i, '').trim();
      const sIds = [targetStudentId, cleanSid, `GCT-${cleanSid}`];

      const cleanSub = targetSubject.replace(/\s+/g, ' ').trim();
      const normSub = normalizeSubjCode(cleanSub);
      const subjectAliases = new Set([cleanSub, normSub, targetSubject.trim()]);

      try {
        const cachedSubs = await getCachedSubjects();
        (cachedSubs || []).forEach(s => {
          if (s.code && (normalizeSubjCode(s.code) === normSub || s.code.toLowerCase() === cleanSub.toLowerCase())) {
            subjectAliases.add(s.id);
            subjectAliases.add(s.code);
            if (s.title) subjectAliases.add(s.title);
          }
          if (s.id && s.id.toLowerCase() === cleanSub.toLowerCase()) {
            subjectAliases.add(s.id);
            if (s.code) subjectAliases.add(s.code);
          }
        });
      } catch (subErr) {
        console.warn('Subject lookup notice on delete:', subErr.message);
      }

      const aliasArray = Array.from(subjectAliases).filter(Boolean);

      // Cross-delete from academic_records safely using .in() to avoid PostgREST query parse issues with spaces
      let acQuery = supabase
        .from('academic_records')
        .delete()
        .in('student_id', sIds)
        .in('subject_id', aliasArray);

      if (targetTerm) {
        acQuery = acQuery.eq('term', targetTerm);
      }
      const { data: acDel, error: acErr } = await acQuery.select();
      if (!acErr && acDel) deletedFromAcademicRecords += acDel.length;

      // Cross-delete from grade_records safely using .in()
      let grQuery = supabase
        .from('grade_records')
        .delete()
        .in('student_id', sIds)
        .in('subject', aliasArray);

      if (targetTerm) {
        const ayMatch = targetTerm.match(/\d{4}-\d{4}/);
        if (ayMatch) {
          grQuery = grQuery.eq('academic_year', ayMatch[0]);
        }
        const isSem2 = /2nd|second/i.test(targetTerm);
        grQuery = grQuery.eq('semester', isSem2 ? 'Second' : 'First');
      }
      const { data: grDel, error: grErr } = await grQuery.select();
      if (!grErr && grDel) deletedFromGradeRecords += grDel.length;
    }

    // Recalculate and synchronize student's year level in students table after deletion (auto-revert)
    const updatedYearLevel = await syncStudentYearLevel(targetStudentId);

    res.json({
      success: true,
      message: 'Grade record deleted successfully from database',
      deletedFromAcademicRecords,
      deletedFromGradeRecords,
      year_level: updatedYearLevel
    });
  } catch (error) {
    console.error('Delete Grade Record Error:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getAcademicRecords,
  createOrUpdateRecord,
  batchUpdateRecords,
  deleteRecord
};
