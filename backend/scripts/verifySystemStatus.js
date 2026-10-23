const { supabase } = require('../config/supabase');

async function verify() {
  console.log('=== VERIFYING SUPABASE STATE ===');
  
  // 1. Check accounts
  const { data: accounts, error: accErr } = await supabase.from('accounts').select('id, username, role, status');
  if (accErr) console.error('Accounts error:', accErr);
  console.log('Current Accounts in Supabase:', accounts);

  // 2. Check profiles
  const { data: profiles, error: profErr } = await supabase.from('profiles').select('id, email, full_name, role');
  if (profErr) console.error('Profiles error:', profErr);
  console.log('Current Profiles in Supabase:', profiles);

  // 3. Check student 12718
  const { data: student12718, error: studErr } = await supabase.from('students').select('*').eq('student_id', '12718');
  if (studErr) console.error('Student error:', studErr);
  console.log('Student 12718 in Supabase:', student12718);

  // 4. Test Chatbot API locally
  console.log('\n=== TESTING CHATBOT API ===');
  
  // Test Tagalog query
  const tagalogRes = await fetch('http://localhost:5000/api/chatbot/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'kumusta po pwede po magpatulong sa subjects ko',
      role: 'student',
      userId: '12718',
      userName: 'AREVALO, MARK LESTER'
    })
  });
  const tagalogJson = await tagalogRes.json();
  console.log('\n[Tagalog Test Response]:\n', tagalogJson.response?.substring(0, 300) + '...');

  // Test English query
  const englishRes = await fetch('http://localhost:5000/api/chatbot/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'hello can you give me advice on my prerequisite subjects',
      role: 'student',
      userId: '12718',
      userName: 'AREVALO, MARK LESTER'
    })
  });
  const englishJson = await englishRes.json();
  console.log('\n[English Test Response]:\n', englishJson.response?.substring(0, 300) + '...');

  // Test Out of Scope in Tagalog
  const outOfScopeRes = await fetch('http://localhost:5000/api/chatbot/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'ano ang recipe ng adobo',
      role: 'student',
      userId: '12718'
    })
  });
  const outOfScopeJson = await outOfScopeRes.json();
  console.log('\n[Out-of-Scope Tagalog Test Response]:\n', outOfScopeJson.response);

  // Test Out of Scope in English
  const outOfScopeEngRes = await fetch('http://localhost:5000/api/chatbot/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'what is the weather today in manila',
      role: 'student',
      userId: '12718'
    })
  });
  const outOfScopeEngJson = await outOfScopeEngRes.json();
  console.log('\n[Out-of-Scope English Test Response]:\n', outOfScopeEngJson.response);
}

verify().catch(console.error);
