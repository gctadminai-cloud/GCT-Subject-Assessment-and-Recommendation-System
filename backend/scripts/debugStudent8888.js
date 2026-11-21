require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
Promise.all([
  sb.from('students').select('student_id, full_name, year_level').eq('student_id', '8888'),
  sb.from('grade_records').select('student_id, subject, year_level, semester, academic_year').eq('student_id', '8888').limit(10),
  sb.from('academic_records').select('student_id, subject_id, grade, term').eq('student_id', '8888').limit(5)
]).then(([s, g, a]) => {
  console.log('STUDENTS:', JSON.stringify(s.data, null, 2));
  console.log('GRADE_RECORDS:', JSON.stringify(g.data, null, 2));
  console.log('ACADEMIC_RECORDS:', JSON.stringify(a.data, null, 2));
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });

