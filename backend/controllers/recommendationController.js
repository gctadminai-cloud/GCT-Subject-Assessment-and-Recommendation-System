const { supabase } = require('../config/supabase');

async function getRecommendations(req, res) {
  try {
    const { status, student_id } = req.query;

    let targetStudentId = student_id;
    if (req.user?.role === 'student') {
      const sId = req.user.student_id || req.user.username;
      const { data: students } = await supabase
        .from('students')
        .select('id, student_id')
        .or(`student_id.eq.${sId},id.eq.${sId}`)
        .limit(1);

      const student = students?.[0];
      if (student) targetStudentId = student.id || student.student_id;
      if (!targetStudentId) targetStudentId = sId;
    }

    let query = supabase
      .from('recommendations')
      .select('*')
      .order('generated_at', { ascending: false });

    if (req.user?.role === 'student') {
      query = query.eq('status', 'approved');
      if (targetStudentId) {
        query = query.eq('student_id', targetStudentId);
      }
    } else {
      if (status) query = query.eq('status', status);
      if (student_id) query = query.eq('student_id', student_id);
    }

    const { data: rows, error: rErr } = await query;
    if (rErr) throw rErr;

    // Fetch related students and profiles for enrichment
    const { data: allStudents } = await supabase.from('students').select('*');
    const { data: allProfiles } = await supabase.from('profiles').select('*');

    const studentMap = new Map((allStudents || []).map(s => [s.id, s]));
    (allStudents || []).forEach(s => {
      if (s.student_id) studentMap.set(s.student_id, s);
    });

    const profileMap = new Map((allProfiles || []).map(p => [p.id, p]));

    const recommendations = (rows || []).map(r => {
      let subjects = [];
      try {
        subjects = typeof r.generated_subjects === 'string' ? JSON.parse(r.generated_subjects) : (r.generated_subjects || []);
      } catch (e) {
        subjects = [];
      }

      const st = studentMap.get(r.student_id);
      const rev = profileMap.get(r.reviewed_by);

      return {
        id: r.id,
        student_id: r.student_id,
        generated_subjects: subjects,
        eligibility: r.eligibility,
        status: r.status,
        reviewed_by: r.reviewed_by,
        review_notes: r.review_notes,
        generated_at: r.generated_at,
        reviewed_at: r.reviewed_at,
        students: {
          id: r.student_id,
          student_id: st?.student_id || r.student_id,
          program: st?.program || 'N/A',
          year_level: st?.year_level || 1,
          section: st?.schedule || st?.section || 'N/A',
          profiles: {
            full_name: st?.full_name || 'Student',
            email: st?.email || `${(st?.student_id || r.student_id || 'student').toLowerCase()}@student.gct.edu.ph`
          }
        },
        reviewer: rev ? {
          full_name: rev.full_name,
          email: rev.email
        } : null
      };
    });

    res.json(recommendations);
  } catch (error) {
    console.error('Get Recommendations Error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function approveRecommendation(req, res) {
  try {
    const { id } = req.params;
    const { review_notes } = req.body;
    const reviewerId = req.user.id;
    const reviewedAt = new Date().toISOString();

    const { error } = await supabase
      .from('recommendations')
      .update({
        status: 'approved',
        reviewed_by: reviewerId,
        reviewed_at: reviewedAt,
        review_notes: review_notes || null
      })
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Recommendation approved successfully', id, status: 'approved' });
  } catch (error) {
    console.error('Approve Recommendation Error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function rejectRecommendation(req, res) {
  try {
    const { id } = req.params;
    const { review_notes } = req.body;
    const reviewerId = req.user.id;
    const reviewedAt = new Date().toISOString();

    const { error } = await supabase
      .from('recommendations')
      .update({
        status: 'rejected',
        reviewed_by: reviewerId,
        reviewed_at: reviewedAt,
        review_notes: review_notes || null
      })
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Recommendation rejected successfully', id, status: 'rejected' });
  } catch (error) {
    console.error('Reject Recommendation Error:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getRecommendations,
  approveRecommendation,
  rejectRecommendation
};
