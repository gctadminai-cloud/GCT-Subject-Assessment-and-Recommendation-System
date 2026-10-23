const { supabase } = require('../config/supabase');

async function getAcademicProgressReport(req, res) {
  try {
    const { data: students } = await supabase.from('students').select('id');
    const totalStudents = students?.length || 0;

    const { data: records } = await supabase.from('academic_records').select('status, subject_id');
    let passedCount = 0;
    let failedCount = 0;

    (records || []).forEach(r => {
      if (r.status === 'passed') passedCount++;
      if (r.status === 'failed') failedCount++;
    });

    const totalEvaluatedRecords = passedCount + failedCount;
    const overallPassRate = totalEvaluatedRecords > 0 ? ((passedCount / totalEvaluatedRecords) * 100).toFixed(1) : '100.0';

    const { data: subjects } = await supabase.from('subjects').select('id, code, title');

    const subjectBreakdown = (subjects || []).map(s => {
      const related = (records || []).filter(r => r.subject_id === s.id);
      const passed = related.filter(r => r.status === 'passed').length;
      const failed = related.filter(r => r.status === 'failed').length;
      const total = passed + failed;
      const rate = total > 0 ? ((passed / total) * 100).toFixed(1) + '%' : '100.0%';

      return {
        code: s.code,
        title: s.title,
        passed,
        failed,
        passRate: rate
      };
    });

    res.json({
      summary: {
        totalStudents,
        totalEvaluatedRecords,
        passedCount,
        failedCount,
        overallPassRate: `${overallPassRate}%`
      },
      subjectBreakdown
    });
  } catch (error) {
    console.error('Academic Progress Report Error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getEnrollmentSummaryReport(req, res) {
  try {
    const { data: accounts } = await supabase.from('accounts').select('role, status');
    const pendingStudentApprovals = (accounts || []).filter(a => a.role === 'student' && a.status === 'pending').length;

    const { data: recommendations } = await supabase.from('recommendations').select('student_id, status, eligibility');
    const pendingRecommendationsToReview = (recommendations || []).filter(r => r.status === 'pending_review').length;
    const approvedRecommendations = (recommendations || []).filter(r => r.status === 'approved').length;
    const eligibleStudentsCount = (recommendations || []).filter(r => r.eligibility === 'eligible').length;
    const notEligibleStudentsCount = (recommendations || []).filter(r => r.eligibility === 'not_eligible').length;

    const { data: students } = await supabase.from('students').select('id, student_id, year_level');

    const yearLevels = [1, 2, 3, 4];
    const distributionByYear = yearLevels.map(yl => {
      const yearStudents = (students || []).filter(s => Number(s.year_level) === yl);
      let eligible = 0;
      let notEligible = 0;

      yearStudents.forEach(st => {
        const rec = (recommendations || []).find(r => r.student_id === st.id || r.student_id === st.student_id);
        if (rec) {
          if (rec.eligibility === 'eligible') eligible++;
          else notEligible++;
        }
      });

      return {
        year_level: yl,
        eligible,
        notEligible
      };
    });

    res.json({
      summary: {
        pendingStudentApprovals,
        pendingRecommendationsToReview,
        approvedRecommendations,
        eligibleStudentsCount,
        notEligibleStudentsCount
      },
      distributionByYear
    });
  } catch (error) {
    console.error('Enrollment Summary Report Error:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getAcademicProgressReport,
  getEnrollmentSummaryReport
};
