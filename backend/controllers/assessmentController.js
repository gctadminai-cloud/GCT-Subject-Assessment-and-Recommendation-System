const { supabase } = require('../config/supabase');
const { evaluateStudent, sortGradesNewestFirst } = require('../services/assessmentEngine');
const { getPassingThreshold, getMaxFailedPrereqs } = require('./settingsController');

async function runAssessmentForStudent(req, res) {
  try {
    const { studentId } = req.params;

    // 1. Fetch Student Record from Supabase
    let { data: students } = await supabase
      .from('students')
      .select('*')
      .or(`id.eq.${studentId},student_id.eq.${studentId}`)
      .limit(1);

    let student = students?.[0];
    if (!student) {
      return res.status(404).json({ error: 'Student record not found' });
    }

    // 2. Fetch Student Grades from Supabase (both academic_records and imported grade_records)
    const { data: academicRecs } = await supabase
      .from('academic_records')
      .select('*')
      .limit(10000)
      .or(`student_id.eq.${student.id},student_id.eq.${student.student_id}`);

    const cleanSId = String(student.student_id || student.id).replace(/^GCT-/i, '').trim();
    const { data: historicalGrades } = await supabase
      .from('grade_records')
      .select('*')
      .limit(10000)
      .or(`student_id.eq.${student.student_id},student_id.eq.${cleanSId},student_id.eq.GCT-${cleanSId}`);

    // 3. Build normalized grade records — include academic_year + semester metadata
    //    so the engine can sort newest-first and ignore old failures retaken+passed in later sems
    const semNumeric = (raw) => {
      const s = String(raw || '').toLowerCase();
      if (s.includes('2nd') || s === '2' || s.includes('second')) return 2;
      if (s.includes('summer')) return 3;
      return 1;
    };

    const rawHistorical = (historicalGrades || []).map(g => {
      const semN = semNumeric(g.semester);
      const ay = String(g.academic_year || '').trim() || (g.year_level ? `${2024 - (5 - Number(g.year_level))}-${2025 - (5 - Number(g.year_level))}` : '2023-2024');
      const termLabel = `${ay} ${semN === 2 ? '2nd' : (semN === 3 ? 'Summer' : '1st')} Sem`;
      return {
        id: `gr-${g.id}`,
        student_id: g.student_id,
        code: g.subject,
        subject: g.subject,
        grade: g.grade,
        raw_grade: g.raw_grade,
        status: (g.raw_grade === '9' || g.grade === 9 || String(g.raw_grade).toUpperCase() === 'DRP') ? 'dropped' : ((g.grade === 5 || g.raw_grade === '5') ? 'failed' : 'passed'),
        academic_year: ay,
        semester: semN,
        year_level: Number(g.year_level) || null,
        term: termLabel
      };
    });

    const rawAcademic = (academicRecs || []).map(r => ({
      ...r,
      academic_year: r.academic_year || (r.term ? r.term.match(/\d{4}-\d{4}/)?.[0] : null) || '2025-2026',
      semester: r.semester || semNumeric(r.term),
      term: r.term || '2025-2026 1st Sem'
    }));

    // 🔴 Sort NEWEST-FIRST + then pass to engine (ensures latest academic year data takes precedence
    // (engine also sorts internally, but we do it here for a fully deduped baseline)
    const studentGrades = sortGradesNewestFirst([...rawHistorical, ...rawAcademic]);

    const filterAY = String(req.query.academic_year || '').trim();
    let scopedGrades = studentGrades;
    if (filterAY) {
      scopedGrades = studentGrades.filter(g => {
        const gAY = String(g.academic_year || '').trim();
        return gAY.toLowerCase() === filterAY.toLowerCase();
      });
    }

    // 3. Fetch Curriculum Subjects from Supabase
    const { data: curriculumSubjects } = await supabase
      .from('subjects')
      .select('*')
      .eq('program', student.program || 'BSIT')
      .order('year_level', { ascending: true })
      .order('semester', { ascending: true });

    // 4. Fetch Prerequisites from Supabase
    const { data: prerequisites } = await supabase
      .from('prerequisites')
      .select('*');

    // 5. Fetch Settings
    const passingThreshold = await getPassingThreshold();
    const maxFailedPrereqs = await getMaxFailedPrereqs();

    // 6. Run Assessment Engine — PASS studentInfo catalog metadata for target term advancement
    let activeAcademicYear = '2026-2027';
    try {
      const { data: aySetting } = await supabase.from('settings').select('value').eq('key', 'activeAcademicYear').limit(1);
      if (aySetting?.[0]?.value) activeAcademicYear = aySetting[0].value;
    } catch (e) {}

    const evaluation = evaluateStudent({
      studentGrades: scopedGrades || [],
      curriculumSubjects: curriculumSubjects || [],
      prerequisites: prerequisites || [],
      studentInfo: {
        year_level: student.year_level,
        semester: student.semester,
        program: student.program
      },
      passingThreshold,
      maxFailedPrereqs,
      activeAcademicYear
    });

    // 7. Store Recommendation into Supabase recommendations table
    const newRecommendation = {
      id: 'rec-' + Date.now(),
      student_id: student.student_id || student.id,
      generated_subjects: JSON.stringify(evaluation.recommendedSubjects),
      eligibility: evaluation.eligibility,
      status: 'pending_review',
      generated_at: new Date().toISOString()
    };

    const { error: recErr } = await supabase
      .from('recommendations')
      .insert([newRecommendation]);

    if (recErr) throw recErr;

    const returnedRecommendation = {
      ...newRecommendation,
      generated_subjects: evaluation.recommendedSubjects
    };

    res.status(201).json({
      message: 'Assessment completed and pending recommendation created',
      recommendation: returnedRecommendation,
      evaluation
    });
  } catch (error) {
    console.error('Run Assessment Error:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  runAssessmentForStudent
};
