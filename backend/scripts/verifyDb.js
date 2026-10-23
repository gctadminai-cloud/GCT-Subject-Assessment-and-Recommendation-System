/** verifyDb.js - confirms the data really landed in Supabase. Run: node scripts/verifyDb.js */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const count = async (t, f) => { let q = sb.from(t).select('*', { count: 'exact', head: true }); if (f) q = f(q); const { count: c, error } = await q; return error ? `ERROR: ${error.message}` : c; };
(async () => {
  const exp = { students: 250, 'accounts (bulk_imported)': 250, grade_records: 11374 };
  console.log('students              :', await count('students'), '(expected', exp.students + ')');
  console.log('accounts bulk_imported:', await count('accounts', q => q.eq('bulk_imported', true)), '(expected 250)');
  console.log('registrar accounts    :', await count('accounts', q => q.in('role', ['registrar_admin', 'registrar_staff'])), '(expected 2)');
  console.log('grade_records         :', await count('grade_records'), '(expected 11374)');
  console.log('  needs_review        :', await count('grade_records', q => q.eq('needs_review', true)), '(expected 265)');
  const { data } = await sb.from('accounts').select('password_hash').eq('username', '10094').maybeSingle();
  console.log('login 10094/bhcwQ     :', data && await bcrypt.compare('bhcwQ', data.password_hash) ? 'OK' : 'FAILED');
})();
